import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

interface CompleteBody {
  finalState?: unknown;
  teams?: { id: string; name: string; score: number }[];
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

    const { data: quizData } = await supabase
      .from("quizzes")
      .select("title, description, theme, time_limit, quiz_data")
      .eq("id", existingRun.quiz_id)
      .single();

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

    const rankedTeams = rankTeams(teams ?? []);
    const winner = rankedTeams[0];

    const endTime = new Date();
    const durationSeconds = Math.max(
      0,
      Math.round(
        (endTime.getTime() - new Date(existingRun.started_at).getTime()) / 1000
      )
    );

    const { data, error } = await supabase
      .from("quiz_runs")
      .update({
        ended_at: endTime.toISOString(),
        duration_seconds: durationSeconds,
        quiz_title: quizData?.title ?? "Uten navn",
        quiz_description: quizData?.description ?? null,
        quiz_theme: quizData?.theme ?? null,
        quiz_time_limit: quizData?.time_limit ?? null,
        final_state: { ...(finalState as object), categorySummary },
        total_questions: resolvedTotal,
        answered_questions: resolvedAnswered,
        team_results: rankedTeams,
        winning_team_name: winner?.teamName ?? null,
        winning_score: winner ? winner.finalScore : null,
        updated_at: endTime.toISOString(),
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

function readAnsweredKeys(finalState: unknown): string[] {
  if (!finalState || typeof finalState !== "object") return [];
  const raw = finalState as Record<string, unknown>;
  if (Array.isArray(raw.answeredKeys)) {
    return raw.answeredKeys.filter((k): k is string => typeof k === "string");
  }
  // Legacy shape: whole board in the run.
  if (Array.isArray(raw.categories)) {
    const keys: string[] = [];
    (raw.categories as { name?: string; questions?: { answered?: boolean }[] }[]).forEach(
      (category) => {
        (category.questions ?? []).forEach((question, index) => {
          if (question?.answered) keys.push(`${category.name}|${index}`);
        });
      }
    );
    return keys;
  }
  return [];
}

interface CategorySummary {
  name: string;
  total: number;
  answered: number;
}

function buildCategorySummary(
  quizData: unknown,
  answeredKeys: string[]
): CategorySummary[] {
  const answered = new Set(answeredKeys);
  if (!quizData || typeof quizData !== "object") return [];
  const categories = (quizData as { categories?: unknown }).categories;
  if (!Array.isArray(categories)) return [];

  return categories.map((category) => {
    const name = String((category as { name?: unknown })?.name ?? "Uten navn");
    const questions = (category as { questions?: unknown[] })?.questions;
    const total = Array.isArray(questions) ? questions.length : 0;
    let answeredCount = 0;
    for (let i = 0; i < total; i += 1) {
      if (answered.has(`${name}|${i}`)) answeredCount += 1;
    }
    return { name, total, answered: answeredCount };
  });
}

function rankTeams(teams: { id: string; name: string; score: number }[]) {
  const sorted = [...teams].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name, "nb");
  });

  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((team, index) => {
    const rank = lastScore === null || team.score < lastScore ? index + 1 : lastRank;
    lastScore = team.score;
    lastRank = rank;
    return {
      teamId: team.id,
      teamName: team.name,
      finalScore: team.score,
      rank,
    };
  });
}
