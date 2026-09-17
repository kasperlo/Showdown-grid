import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

/**
 * POST - Start a live session, or hand back the one that already exists.
 *
 * This is deliberately idempotent per (user, quiz). Two effects racing on the
 * first opened question used to insert two rows, and the orphan could win the
 * next restore and show an empty board mid-quiz.
 */
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
    const { quizId, startedAt, finalState } = body;

    if (!quizId || !startedAt || !finalState) {
      return NextResponse.json(
        { error: "Missing required fields: quizId, startedAt, finalState" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("quiz_runs")
      .select("*")
      .eq("user_id", user.id)
      .eq("quiz_id", quizId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ run: existing, reused: true });
    }

    const { data: quizData, error: quizError } = await supabase
      .from("quizzes")
      .select("title, description, theme, time_limit, quiz_data")
      .eq("id", quizId)
      .single();

    if (quizError || !quizData) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const totalQuestions = countQuestions(quizData.quiz_data);

    const { data, error } = await supabase
      .from("quiz_runs")
      .insert({
        quiz_id: quizId,
        user_id: user.id,
        started_at: startedAt,
        ended_at: null,
        duration_seconds: null,
        quiz_title: quizData.title,
        quiz_description: quizData.description,
        quiz_theme: quizData.theme,
        quiz_time_limit: quizData.time_limit,
        final_state: finalState,
        total_questions: totalQuestions,
        answered_questions: 0,
        team_results: [],
        winning_team_name: null,
        winning_score: null,
      })
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
    const includeLive = searchParams.get("includeLive") === "true";
    const limit = clampLimit(searchParams.get("limit"));

    let query = supabase
      .from("quiz_runs")
      .select(
        "id, quiz_id, quiz_title, started_at, ended_at, duration_seconds, total_questions, answered_questions, completion_percentage, winning_team_name, winning_score"
      )
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (quizId) {
      query = query.eq("quiz_id", quizId);
    }
    if (!includeLive) {
      // Live sessions have no ended_at, so they rendered as "Invalid Date" and
      // "NaNm NaNs" in the history list.
      query = query.not("ended_at", "is", null);
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

function clampLimit(raw: string | null): number {
  const parsed = parseInt(raw || "20", 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(200, Math.max(1, parsed));
}

function countQuestions(quizData: unknown): number {
  if (!quizData || typeof quizData !== "object") return 0;
  const categories = (quizData as { categories?: unknown }).categories;
  if (!Array.isArray(categories)) return 0;
  return categories.reduce((sum: number, category) => {
    const questions = (category as { questions?: unknown })?.questions;
    return sum + (Array.isArray(questions) ? questions.length : 0);
  }, 0);
}
