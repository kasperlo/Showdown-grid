import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

interface CollaboratorRow {
  user_id: string;
  email: string;
  created_at: string;
}

async function requireOwnedQuiz(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quizId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, share_token")
    .eq("id", quizId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// GET - Share status and collaborator list. Owner only.
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

    const quiz = await requireOwnedQuiz(supabase, id, user.id);
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const { data: collaborators, error: collabError } = await supabase.rpc(
      "get_quiz_collaborators",
      { p_quiz_id: id }
    );

    if (collabError) throw collabError;

    return NextResponse.json({
      shareToken: quiz.share_token,
      collaborators: (collaborators || []).map((c: CollaboratorRow) => ({
        userId: c.user_id,
        email: c.email,
        createdAt: c.created_at,
      })),
    });
  } catch (error) {
    console.error("Error loading share status:", error);
    return NextResponse.json(
      { error: "Kunne ikke laste delingsstatus" },
      { status: 500 }
    );
  }
}

// POST - Turn sharing on, generating a new token (also rotates an existing one).
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

    const shareToken = crypto.randomUUID();

    const { data, error } = await supabase
      .from("quizzes")
      .update({ share_token: shareToken })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("share_token")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ shareToken: data.share_token });
  } catch (error) {
    console.error("Error enabling sharing:", error);
    return NextResponse.json(
      { error: "Kunne ikke aktivere deling" },
      { status: 500 }
    );
  }
}

// DELETE - Turn the link off. Existing collaborators keep their access.
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
      .from("quizzes")
      .update({ share_token: null })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disabling sharing:", error);
    return NextResponse.json(
      { error: "Kunne ikke slå av deling" },
      { status: 500 }
    );
  }
}
