import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// DELETE - Remove one collaborator's edit access. Owner only (enforced by RLS
// on quiz_collaborators: only the quiz owner may delete a row).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id, userId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("quiz_collaborators")
      .delete()
      .eq("quiz_id", id)
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing collaborator:", error);
    return NextResponse.json(
      { error: "Kunne ikke fjerne redaktøren" },
      { status: 500 }
    );
  }
}
