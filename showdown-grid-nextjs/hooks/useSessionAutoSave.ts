import { useEffect, useRef } from "react";
import { useGameStore } from "@/utils/store";
import { useDebounce } from "@/utils/useDebounce";

/**
 * Custom hook for auto-saving quiz sessions
 * Debounces state changes and calls saveSession() with rate limiting (max 1/sec)
 */
export function useSessionAutoSave() {
  const activeRunId = useGameStore((state) => state.activeRunId);
  const saveSession = useGameStore((state) => state.saveSession);
  const categories = useGameStore((state) => state.categories);
  const teams = useGameStore((state) => state.teams);
  const adjustmentLog = useGameStore((state) => state.adjustmentLog);

  // Debounce session state changes (1000ms delay)
  const debouncedState = useDebounce(
    {
      categories,
      teams,
      adjustmentLog,
    },
    1000
  );

  // Track if we've already saved this state to avoid duplicate saves
  const lastSavedStateRef = useRef<string | null>(null);

  useEffect(() => {
    // Only auto-save if there's an active session
    if (!activeRunId) {
      return;
    }

    // Create a simple hash of the state to detect changes
    const stateHash = JSON.stringify(debouncedState);

    // Skip if this state was already saved
    if (lastSavedStateRef.current === stateHash) {
      return;
    }

    // Save the session (rate limiting is handled inside saveSession)
    saveSession().then(() => {
      lastSavedStateRef.current = stateHash;
    }).catch((error) => {
      console.error("Auto-save failed:", error);
      // Don't update lastSavedStateRef on error so we can retry
    });
  }, [debouncedState, activeRunId, saveSession]);
}


