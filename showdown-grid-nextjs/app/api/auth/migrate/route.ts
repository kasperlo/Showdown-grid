import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

/**
 * POST /api/auth/migrate
 * Migrates data from anonymous user to registered user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fromUserId, toUserId } = body;

    // Validation
    if (!fromUserId || !toUserId) {
      return NextResponse.json(
        { error: "Missing fromUserId or toUserId" },
        { status: 400 }
      );
    }

    if (fromUserId === toUserId) {
      return NextResponse.json(
        { error: "Cannot migrate to same user" },
        { status: 400 }
      );
    }

    // Verify that toUserId matches the authenticated user
    if (toUserId !== user.id) {
      return NextResponse.json(
        { error: "Can only migrate to authenticated user" },
        { status: 403 }
      );
    }

    console.log(`[Migration] Starting migration from ${fromUserId} to ${toUserId}`);

    // Step 1: Migrate quizzes
    const { data: quizzesToMigrate, error: quizzesSelectError } = await supabase
      .from("quizzes")
      .select("id")
      .eq("user_id", fromUserId);

    if (quizzesSelectError) {
      console.error("[Migration] Error selecting quizzes:", quizzesSelectError);
      throw quizzesSelectError;
    }

    let quizzesMigrated = 0;
    if (quizzesToMigrate && quizzesToMigrate.length > 0) {
      const { error: quizzesUpdateError } = await supabase
        .from("quizzes")
        .update({ user_id: toUserId, updated_at: new Date().toISOString() })
        .eq("user_id", fromUserId);

      if (quizzesUpdateError) {
        console.error("[Migration] Error updating quizzes:", quizzesUpdateError);
        throw quizzesUpdateError;
      }

      quizzesMigrated = quizzesToMigrate.length;
      console.log(`[Migration] Migrated ${quizzesMigrated} quizzes`);
    }

    // Step 2: Migrate quiz_runs (sessions)
    const { data: sessionsToMigrate, error: sessionsSelectError } = await supabase
      .from("quiz_runs")
      .select("id")
      .eq("user_id", fromUserId);

    if (sessionsSelectError) {
      console.error("[Migration] Error selecting sessions:", sessionsSelectError);
      throw sessionsSelectError;
    }

    let sessionsMigrated = 0;
    if (sessionsToMigrate && sessionsToMigrate.length > 0) {
      const { error: sessionsUpdateError } = await supabase
        .from("quiz_runs")
        .update({ user_id: toUserId, updated_at: new Date().toISOString() })
        .eq("user_id", fromUserId);

      if (sessionsUpdateError) {
        console.error("[Migration] Error updating sessions:", sessionsUpdateError);
        throw sessionsUpdateError;
      }

      sessionsMigrated = sessionsToMigrate.length;
      console.log(`[Migration] Migrated ${sessionsMigrated} sessions`);
    }

    // Step 3: Update users table (active_quiz_id reference)
    const { data: userData, error: userSelectError } = await supabase
      .from("users")
      .select("active_quiz_id")
      .eq("user_id", fromUserId)
      .single();

    if (userSelectError && userSelectError.code !== "PGRST116") {
      // PGRST116 = not found, which is OK
      console.error("[Migration] Error selecting user data:", userSelectError);
    }

    if (userData && userData.active_quiz_id) {
      // Upsert to new user
      const { error: userUpsertError } = await supabase
        .from("users")
        .upsert({
          user_id: toUserId,
          active_quiz_id: userData.active_quiz_id,
          updated_at: new Date().toISOString(),
        });

      if (userUpsertError) {
        console.error("[Migration] Error upserting user data:", userUpsertError);
        // Don't throw - this is not critical
      } else {
        console.log("[Migration] Migrated active_quiz_id reference");
      }

      // Delete old user entry
      const { error: userDeleteError } = await supabase
        .from("users")
        .delete()
        .eq("user_id", fromUserId);

      if (userDeleteError) {
        console.error("[Migration] Error deleting old user entry:", userDeleteError);
        // Don't throw - this is not critical
      }
    }

    console.log(`[Migration] Migration completed successfully`);

    return NextResponse.json({
      success: true,
      quizzesMigrated,
      sessionsMigrated,
    });
  } catch (error: unknown) {
    console.error("[Migration] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Migration failed";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


