import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// POST - Redeem a share link: adds the signed-in user as a collaborator on
// the quiz the token belongs to. All validation happens inside
// join_quiz_by_token() in the database, so an invalid or revoked token never
// reveals which quiz it would have pointed to.
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

    const { token } = await request.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Mangler lenke-token" }, { status: 400 });
    }

    const { data: quizId, error } = await supabase.rpc("join_quiz_by_token", {
      p_token: token,
    });

    if (error) {
      if (error.message?.includes("invalid_token")) {
        return NextResponse.json(
          { error: "Lenken er ugyldig eller er slått av" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ quizId });
  } catch (error) {
    console.error("Error joining quiz via share link:", error);
    return NextResponse.json(
      { error: "Kunne ikke bli med på quizen" },
      { status: 500 }
    );
  }
}
