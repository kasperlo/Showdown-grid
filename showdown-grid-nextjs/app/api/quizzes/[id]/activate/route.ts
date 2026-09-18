import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// POST - Set a quiz as active
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

    // Verify the quiz exists and the user may edit it: owner, or a
    // collaborator added through a share link. Deliberately not just "RLS
    // lets me read this row" — that would also be true for any public quiz,
    // and activating one you can't edit would point active_quiz_id at a
    // board you can only watch.
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();

    if (quizError) throw quizError;
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    if (quiz.user_id !== user.id) {
      const { data: collaborator, error: collabError } = await supabase
        .from("quiz_collaborators")
        .select("quiz_id")
        .eq("quiz_id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (collabError) throw collabError;
      if (!collaborator) {
        return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
      }
    }

    // Set this quiz as active in users table
    const { error } = await supabase.from("users").upsert({
      user_id: user.id,
      active_quiz_id: id,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error activating quiz:", error);
    return NextResponse.json(
      { error: "Failed to activate quiz" },
      { status: 500 }
    );
  }
}
