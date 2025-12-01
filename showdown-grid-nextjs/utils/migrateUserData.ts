/**
 * Utility functions for migrating user data from anonymous to registered users
 */

export interface MigrationResult {
  success: boolean;
  quizzesMigrated: number;
  sessionsMigrated: number;
  error?: string;
}

/**
 * Validates that the migration can proceed
 */
export function validateMigration(
  fromUserId: string,
  toUserId: string
): { valid: boolean; error?: string } {
  if (!fromUserId || !toUserId) {
    return { valid: false, error: "Missing user IDs" };
  }

  if (fromUserId === toUserId) {
    return { valid: false, error: "Cannot migrate to same user" };
  }

  return { valid: true };
}

/**
 * Client-side helper to trigger server-side migration
 */
export async function migrateUserData(
  fromUserId: string,
  toUserId: string
): Promise<MigrationResult> {
  try {
    const response = await fetch("/api/auth/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromUserId, toUserId }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        quizzesMigrated: 0,
        sessionsMigrated: 0,
        error: error.error || "Migration failed",
      };
    }

    const result = await response.json();
    return {
      success: true,
      quizzesMigrated: result.quizzesMigrated || 0,
      sessionsMigrated: result.sessionsMigrated || 0,
    };
  } catch (error: any) {
    return {
      success: false,
      quizzesMigrated: 0,
      sessionsMigrated: 0,
      error: error.message || "Unknown error",
    };
  }
}

