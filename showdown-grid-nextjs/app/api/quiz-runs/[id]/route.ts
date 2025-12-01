import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET - Fetch a single quiz run by ID
export async function GET(
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

    const { data, error } = await supabase
      .from("quiz_runs")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      console.error("[API /quiz-runs/[id] GET] Error:", error);
      return NextResponse.json(
        { error: "Quiz run not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ run: data });
  } catch (error) {
    console.error("[API /quiz-runs/[id] GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to load quiz run" },
      { status: 500 }
    );
  }
}

// PATCH - Update a live session
export async function PATCH(
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

    // Verify that the session exists, belongs to user, and is still active (ended_at IS NULL)
    const { data: existingRun, error: fetchError } = await supabase
      .from("quiz_runs")
      .select("id, user_id, ended_at")
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
        { error: "Cannot update completed session" },
        { status: 400 }
      );
    }

    // Update the session state
    const { data, error } = await supabase
      .from("quiz_runs")
      .update({
        final_state: finalState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[API /quiz-runs/[id] PATCH] Error:", error);
      throw error;
    }

    return NextResponse.json({ run: data });
  } catch (error) {
    console.error("[API /quiz-runs/[id] PATCH] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a quiz run
export async function DELETE(
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

    const { error } = await supabase
      .from("quiz_runs")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[API /quiz-runs/[id] DELETE] Error:", error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /quiz-runs/[id] DELETE] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to delete quiz run" },
      { status: 500 }
    );
  }
}
