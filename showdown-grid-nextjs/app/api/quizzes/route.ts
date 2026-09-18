import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sanitizeQuizData } from "@/lib/sanitize-template";

const DEFAULT_POINTS = [100, 200, 300, 400, 500];

// GET - List all quizzes for the user
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

    const SELECT_COLUMNS =
      "id, title, description, is_public, time_limit, theme, created_at, updated_at, user_id, quiz_data";

    const [
      { data: owned, error: ownedError },
      { data: userRow },
      { data: collabRows, error: collabError },
    ] = await Promise.all([
      supabase
        .from("quizzes")
        .select(SELECT_COLUMNS)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("users")
        .select("active_quiz_id")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("quiz_collaborators")
        .select("quiz_id")
        .eq("user_id", user.id),
    ]);

    if (ownedError) throw ownedError;
    if (collabError) throw collabError;

    const collabIds = (collabRows || []).map((row) => row.quiz_id);
    let shared: typeof owned = [];
    if (collabIds.length > 0) {
      const { data, error: sharedError } = await supabase
        .from("quizzes")
        .select(SELECT_COLUMNS)
        .in("id", collabIds)
        .order("updated_at", { ascending: false });

      if (sharedError) throw sharedError;
      shared = data;
    }

    // The list view shows how finished each quiz is and which one is active,
    // which needs a count but not the whole board, so the payload is reduced
    // here rather than in the client. Owner id is reduced to a boolean too:
    // the card only needs to know whether the current user may delete it or
    // manage its sharing, not who else owns it.
    const toCard = (quiz: NonNullable<typeof owned>[number]) => {
      const { quiz_data, user_id, ...rest } = quiz;
      return {
        ...rest,
        question_count: countQuestions(quiz_data),
        category_count: countCategories(quiz_data),
        is_active: quiz.id === userRow?.active_quiz_id,
        isOwnedByCurrentUser: user_id === user.id,
      };
    };

    const quizzes = [...(owned || []).map(toCard), ...(shared || []).map(toCard)].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return NextResponse.json({ quizzes });
  } catch (error) {
    console.error("Error loading quizzes:", error);
    return NextResponse.json(
      { error: "Failed to load quizzes" },
      { status: 500 }
    );
  }
}

// POST - Create a new quiz, optionally as a copy of an existing one
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
    const { title, description, quizData, setAsActive, copyFromQuizId } = body;

    const trimmedTitle = String(title ?? "").trim();
    if (!trimmedTitle) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    let seedData = quizData;
    let seedTheme = "classic";
    let seedTimeLimit: number | null = null;

    if (copyFromQuizId) {
      // A copy may be made from any quiz the caller can read, which RLS limits
      // to their own quizzes plus public ones.
      const { data: source, error: sourceError } = await supabase
        .from("quizzes")
        .select("quiz_data, theme, time_limit, is_public, user_id")
        .eq("id", copyFromQuizId)
        .maybeSingle();

      if (sourceError) throw sourceError;
      if (!source) {
        return NextResponse.json(
          { error: "Kildequizen finnes ikke" },
          { status: 404 }
        );
      }
      if (!source.is_public && source.user_id !== user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      seedData = source.quiz_data;
      seedTheme = source.theme ?? "classic";
      seedTimeLimit = source.time_limit ?? null;
    }

    const sanitized = sanitizeQuizData(seedData ?? starterQuizData());
    const finalData = sanitized.categories.length
      ? sanitized
      : sanitizeQuizData(starterQuizData());

    const { data, error } = await supabase
      .from("quizzes")
      .insert({
        user_id: user.id,
        title: trimmedTitle.slice(0, 200),
        description: String(description ?? "").slice(0, 1000),
        theme: seedTheme,
        time_limit: seedTimeLimit,
        quiz_data: finalData,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (setAsActive) {
      const { error: upsertError } = await supabase.from("users").upsert({
        user_id: user.id,
        active_quiz_id: data.id,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) {
        console.error("Failed to set quiz as active:", upsertError);
      }
    }

    return NextResponse.json({ quiz: data }, { status: 201 });
  } catch (error) {
    console.error("Error creating quiz:", error);
    return NextResponse.json(
      { error: "Failed to create quiz" },
      { status: 500 }
    );
  }
}

/**
 * A new quiz gets an empty but playable 5x5 board. It used to get
 * `categories: []`, which rendered as a blank page with no way to tell whether
 * the quiz was broken or just new.
 */
function starterQuizData() {
  return {
    categories: Array.from({ length: 5 }, (_, i) => ({
      name: `Kategori ${i + 1}`,
      questions: DEFAULT_POINTS.map((points) => ({
        points,
        question: "",
        answer: "",
        imageUrl: "",
        isJoker: false,
        jokerTask: "",
        jokerTimer: 10,
        answered: false,
      })),
    })),
    teams: [
      { id: "team-1", name: "Lag 1", score: 0, players: [] },
      { id: "team-2", name: "Lag 2", score: 0, players: [] },
      { id: "team-3", name: "Lag 3", score: 0, players: [] },
    ],
    jokerTimeLimit: 10,
  };
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
