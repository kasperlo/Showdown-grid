import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { Category, Team, AdjustmentEntry } from "@/utils/types";

// POST - Complete a live session
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

    const body = await request.json();
    const { finalState } = body;

    if (!finalState) {
      return NextResponse.json(
        { error: "finalState is required" },
        { status: 400 }
      );
    }

    // Verify that the session exists, belongs to user, and is still active
    const { data: existingRun, error: fetchError } = await supabase
      .from("quiz_runs")
      .select("id, user_id, started_at, ended_at, quiz_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existingRun) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (existingRun.ended_at !== null) {
      return NextResponse.json(
        { error: "Session already completed" },
        { status: 400 }
      );
    }

    // Fetch quiz metadata for snapshot
    const { data: quizData, error: quizError } = await supabase
      .from("quizzes")
      .select("title, description, theme, time_limit")
      .eq("id", existingRun.quiz_id)
      .single();

    if (quizError || !quizData) {
      return NextResponse.json(
        { error: "Quiz not found" },
        { status: 404 }
      );
    }

    // Calculate statistics from final state
    const categories: Category[] = finalState.categories || [];
    const teams: Team[] = finalState.teams || [];
    const adjustmentLog: AdjustmentEntry[] = finalState.adjustmentLog || [];

    const totalQuestions = categories.reduce(
      (sum, cat) => sum + cat.questions.length,
      0
    );
    const answeredQuestions = categories.reduce(
      (sum, cat) => sum + cat.questions.filter((q) => q.answered).length,
      0
    );

    // Calculate team results and rankings
    const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
    const teamResults = sortedTeams.map((team, index) => ({
      teamId: team.id,
      teamName: team.name,
      finalScore: team.score,
      rank: index + 1,
    }));

    const winningTeam = sortedTeams[0];
    const winningTeamName = winningTeam?.name || null;
    const winningScore = winningTeam?.score || null;

    // Calculate duration
    const endTime = new Date();
    const startTime = new Date(existingRun.started_at);
    const durationSeconds = Math.round(
      (endTime.getTime() - startTime.getTime()) / 1000
    );

    // Update session to mark as completed
    const { data, error } = await supabase
      .from("quiz_runs")
      .update({
        ended_at: endTime.toISOString(),
        duration_seconds: durationSeconds,
        quiz_title: quizData.title,
        quiz_description: quizData.description,
        quiz_theme: quizData.theme,
        quiz_time_limit: quizData.time_limit,
        final_state: {
          categories,
          teams,
          adjustmentLog,
        },
        total_questions: totalQuestions,
        answered_questions: answeredQuestions,
        team_results: teamResults,
        winning_team_name: winningTeamName,
        winning_score: winningScore,
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


