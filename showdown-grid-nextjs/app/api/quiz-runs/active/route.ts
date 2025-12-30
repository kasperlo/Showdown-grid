import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET - Fetch active session for a quiz
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

    if (!quizId) {
      return NextResponse.json(
        { error: "quizId query parameter is required" },
        { status: 400 }
      );
    }

    // Find active session (ended_at IS NULL) for this user and quiz
    const { data, error } = await supabase
      .from("quiz_runs")
      .select("*")
      .eq("user_id", user.id)
      .eq("quiz_id", quizId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[API /quiz-runs/active GET] Error:", error);
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: "No active session found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ run: data });
  } catch (error) {
    console.error("[API /quiz-runs/active GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to load active session" },
      { status: 500 }
    );
  }
}


