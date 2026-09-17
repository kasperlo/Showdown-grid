import { useEffect, useRef } from "react";
import { useGameStore } from "@/utils/store";
import { extractLiveState } from "@/utils/quiz-template";
import { useDebounce } from "@/utils/useDebounce";

/**
 * Keeps the live session in sync with the server.
 *
 * The previous version marked a state as saved as soon as `saveSession()`
 * resolved — including when it resolved early because of the rate limit. Those
 * changes were then never retried. The rate limiter now schedules the write
 * instead of dropping it, and the fingerprint only advances on an actual write.
 */
export function useSessionAutoSave() {
  const activeRunId = useGameStore((s) => s.activeRunId);
  const saveSession = useGameStore((s) => s.saveSession);
  const flushSession = useGameStore((s) => s.flushSession);
  const categories = useGameStore((s) => s.categories);
  const teams = useGameStore((s) => s.teams);
  const adjustmentLog = useGameStore((s) => s.adjustmentLog);
  const currentTurnTeamId = useGameStore((s) => s.currentTurnTeamId);

  const liveFingerprint = JSON.stringify(
    extractLiveState({ categories, teams, adjustmentLog, currentTurnTeamId })
  );
  const debounced = useDebounce(liveFingerprint, 600);
  const lastQueued = useRef<string | null>(null);

  useEffect(() => {
    if (!activeRunId) return;
    if (lastQueued.current === debounced) return;
    lastQueued.current = debounced;
    void saveSession();
  }, [debounced, activeRunId, saveSession]);

  // A host closing the laptop lid mid-quiz should not lose the last answer.
  useEffect(() => {
    if (!activeRunId) return;

    const flush = () => {
      void flushSession();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeRunId, flushSession]);
}
