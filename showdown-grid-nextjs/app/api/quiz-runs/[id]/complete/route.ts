import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import {
  buildCategorySummary,
  playedWindow,
  rankRunTeams,
  readAnsweredKeys,
  winnerLabel,
  type CompletingTeam,
} from "@/lib/run-summary";

interface CompleteBody {
  finalState?: unknown;
  teams?: CompletingTeam[];
  totalQuestions?: number;
  answeredQuestions?: number;
}

/**
 * POST - Complete a live session.
 *
 * The live state is compact (answered keys + scores), so the board it was played
 * on is read from the quiz to build the per-category summary the history page
 * shows. That summary is frozen into the row: editing the quiz afterwards must
 * not rewrite what a finished night looked like.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CompleteBody = await request.json();
    const { finalState, teams, totalQuestions, answeredQuestions } = body;

    if (!finalState) {
      return NextResponse.json(
        { error: "finalState is required" },
        { status: 400 }
      );
    }

    const { data: existingRun, error: fetchError } = await supabase
      .from("quiz_runs")
      .select("id, user_id, started_at, ended_at, quiz_id, total_questions")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existingRun) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (existingRun.ended_at !== null) {
      // Completing twice is a double-click, not an error worth blocking on.
      const { data: alreadyDone } = await supabase
        .from("quiz_runs")
        .select("*")
        .eq("id", id)
        .single();
      return NextResponse.json({ run: alreadyDone, alreadyCompleted: true });
    }

    const { data: quizData } = existingRun.quiz_id
      ? await supabase
          .from("quizzes")
          .select("title, description, theme, time_limit, quiz_data")
          .eq("id", existingRun.quiz_id)
          .maybeSingle()
      : { data: null };

    const answeredKeys = readAnsweredKeys(finalState);
    const categorySummary = buildCategorySummary(
      quizData?.quiz_data,
      answeredKeys
    );

    const resolvedTotal =
      typeof totalQuestions === "number" && totalQuestions >= 0
        ? totalQuestions
        : categorySummary.reduce((sum, c) => sum + c.total, 0) ||
          existingRun.total_questions ||
          0;

    const resolvedAnswered =
      typeof answeredQuestions === "number" && answeredQuestions >= 0
        ? Math.min(answeredQuestions, resolvedTotal)
        : Math.min(answeredKeys.length, resolvedTotal);

    const rankedTeams = rankRunTeams(teams ?? []);
    const winner = rankedTeams[0];

    const now = new Date();
    const { endedAt, durationSeconds } = playedWindow(
      existingRun.started_at,
      (finalState as { lastActionAt?: unknown }).lastActionAt,
      now
    );

    // The run already holds the quiz's title and settings from when it was
    // started. They are only refreshed when the quiz can still be read: a
    // quiz made private or deleted mid-game used to turn the title into
    // "Uten navn".
    const quizSnapshot = quizData
      ? {
          quiz_title: quizData.title ?? "Uten navn",
          quiz_description: quizData.description ?? null,
          quiz_theme: quizData.theme ?? null,
          quiz_time_limit: quizData.time_limit ?? null,
        }
      : {};

    const { data, error } = await supabase
      .from("quiz_runs")
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        ...quizSnapshot,
        final_state: { ...(finalState as object), categorySummary },
        total_questions: resolvedTotal,
        answered_questions: resolvedAnswered,
        team_results: rankedTeams,
        winning_team_name: winnerLabel(rankedTeams),
        winning_score: winner ? winner.finalScore : null,
        updated_at: now.toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[API /quiz-runs/[id]/complete POST] Error:", error);
      throw error;
    }

    return NextResponse.json({ run: data });
  } catch (error) {
    console.error(
      "[API /quiz-runs/[id]/complete POST] Unexpected error:",
      error
    );
    return NextResponse.json(
      { error: "Failed to complete session" },
      { status: 500 }
    );
  }
}
