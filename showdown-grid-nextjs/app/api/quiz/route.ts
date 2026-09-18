import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

/**
 * GET - Load the user's active quiz.
 *
 * There is deliberately no POST here any more. It wrote the whole in-memory
 * game state into `quizzes.quiz_data`, which meant one "Lagre" after a game
 * stored every question as answered and every score as part of the quiz.
 * Writing a quiz now goes through PATCH /api/quizzes/[id], which sanitizes the
 * template server-side.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("active_quiz_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (userError || !userData?.active_quiz_id) {
      return NextResponse.json(
        { message: "No active quiz found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", userData.active_quiz_id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // The active quiz was deleted; the pointer is stale, not an error.
      return NextResponse.json(
        { message: "No active quiz found" },
        { status: 404 }
      );
    }

    let canEdit = data.user_id === user.id;
    if (!canEdit) {
      const { data: collaborator } = await supabase
        .from("quiz_collaborators")
        .select("quiz_id")
        .eq("quiz_id", data.id)
        .eq("user_id", user.id)
        .maybeSingle();
      canEdit = Boolean(collaborator);
    }

    return NextResponse.json({
      data: {
        ...data.quiz_data,
        quizId: data.id,
        quizOwnerId: data.user_id,
        quizTitle: data.title,
        quizDescription: data.description,
        quizTimeLimit: data.time_limit,
        quizTheme: data.theme,
        quizIsPublic: data.is_public,
        canEdit,
      },
    });
  } catch (error) {
    console.error("Error loading quiz:", error);
    return NextResponse.json({ error: "Failed to load quiz" }, { status: 500 });
  }
}
