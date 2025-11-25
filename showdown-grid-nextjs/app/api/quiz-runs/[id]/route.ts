import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET - Fetch a single quiz run by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
      .eq("id", params.id)
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

// DELETE - Delete a quiz run
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
      .eq("id", params.id)
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
