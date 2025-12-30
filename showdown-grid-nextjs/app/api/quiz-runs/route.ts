import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { Category, Team, AdjustmentEntry } from "@/utils/types";

// POST - Save a new quiz run
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { quizId, startedAt, endedAt, finalState } = body;

    if (!quizId || !startedAt || !finalState) {
      return NextResponse.json(
        { error: "Missing required fields: quizId, startedAt, finalState" },
        { status: 400 }
      );
    }

    // Fetch quiz metadata
    const { data: quizData, error: quizError } = await supabase
      .from("quizzes")
      .select("title, description, theme, time_limit")
      .eq("id", quizId)
      .single();

    if (quizError || !quizData) {
      return NextResponse.json(
        { error: "Quiz not found" },
        { status: 404 }
      );
    }

    const categories: Category[] = finalState.categories || [];
    const teams: Team[] = finalState.teams || [];
    const adjustmentLog: AdjustmentEntry[] = finalState.adjustmentLog || [];

    // For live sessions (no endedAt), we'll set minimal required fields
    // Statistics will be calculated when the session is completed
    const isLiveSession = !endedAt;

    const insertData: Record<string, unknown> = {
      quiz_id: quizId,
      user_id: user.id,
      started_at: startedAt,
      ended_at: endedAt || null,
      duration_seconds: null,
      quiz_title: quizData.title,
      quiz_description: quizData.description,
      quiz_theme: quizData.theme,
      quiz_time_limit: quizData.time_limit,
      final_state: {
        categories,
        teams,
        adjustmentLog,
      },
    };

    if (isLiveSession) {
      // For live sessions, set minimal statistics (will be updated on completion)
      const totalQuestions = categories.reduce(
        (sum, cat) => sum + cat.questions.length,
        0
      );
      insertData.total_questions = totalQuestions;
      insertData.answered_questions = 0;
      insertData.team_results = [];
      insertData.winning_team_name = null;
      insertData.winning_score = null;
    } else {
      // For completed sessions, calculate all statistics
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
      const durationSeconds = Math.round(
        (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
      );

      insertData.duration_seconds = durationSeconds;
      insertData.total_questions = totalQuestions;
      insertData.answered_questions = answeredQuestions;
      insertData.team_results = teamResults;
      insertData.winning_team_name = winningTeamName;
      insertData.winning_score = winningScore;
    }

    // Insert quiz run
    const { data, error } = await supabase
      .from("quiz_runs")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("[API /quiz-runs POST] Error:", error);
      throw error;
    }

    return NextResponse.json({ run: data }, { status: 201 });
  } catch (error) {
    console.error("[API /quiz-runs POST] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to save quiz run" },
      { status: 500 }
    );
  }
}

// GET - List quiz runs for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get("quizId");
    const limit = parseInt(searchParams.get("limit") || "20");

    let query = supabase
      .from("quiz_runs")
      .select("id, quiz_title, ended_at, duration_seconds, total_questions, answered_questions, completion_percentage, winning_team_name, winning_score")
      .eq("user_id", user.id)
      .order("ended_at", { ascending: false })
      .limit(limit);

    if (quizId) {
      query = query.eq("quiz_id", quizId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[API /quiz-runs GET] Error:", error);
      throw error;
    }

    return NextResponse.json({ runs: data || [] });
  } catch (error) {
    console.error("[API /quiz-runs GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to load quiz runs" },
      { status: 500 }
    );
  }
}
