import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET - List all public quizzes. No authentication required.
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("quizzes")
      .select(
        "id, title, description, is_public, time_limit, theme, created_at, updated_at, user_id, quiz_data"
      )
      .eq("is_public", true)
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    const quizzes = (data || []).map(({ quiz_data, user_id, ...quiz }) => ({
      ...quiz,
      // The owner id is not shown anywhere, so it is reduced to the one fact the
      // gallery needs instead of being handed to every visitor.
      isOwnedByCurrentUser: user ? user_id === user.id : false,
      question_count: countQuestions(quiz_data),
      category_count: countCategories(quiz_data),
    }));

    return NextResponse.json({ quizzes });
  } catch (error) {
    console.error("Error loading public quizzes:", error);
    return NextResponse.json(
      { error: "Failed to load public quizzes" },
      { status: 500 }
    );
  }
}

function countCategories(quizData: unknown): number {
  if (!quizData || typeof quizData !== "object") return 0;
  const categories = (quizData as { categories?: unknown }).categories;
  return Array.isArray(categories) ? categories.length : 0;
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
