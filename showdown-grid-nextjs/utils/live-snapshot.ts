import type { LiveGameState } from "./types";

/**
 * A copy of the live state in localStorage, so a refresh or a crash mid-quiz
 * never costs more than the last action. The server copy in `quiz_runs` is
 * still the source of truth; this only wins when it is demonstrably newer,
 * which is the case when the last PATCH never made it out.
 */

const PREFIX = "jeoparty:live:";

export interface StoredSnapshot {
  live: LiveGameState;
  savedAt: number;
  runId: string | null;
}

function key(quizId: string) {
  return `${PREFIX}${quizId}`;
}

export function writeSnapshot(
  quizId: string,
  live: LiveGameState,
  runId: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredSnapshot = { live, savedAt: Date.now(), runId };
    window.localStorage.setItem(key(quizId), JSON.stringify(payload));
  } catch {
    // Private mode, blocked storage or a full quota. The server copy still runs.
  }
}

export function readSnapshot(quizId: string): StoredSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(quizId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSnapshot;
    if (!parsed?.live || !Array.isArray(parsed.live.answeredKeys)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSnapshot(quizId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(quizId));
  } catch {
    // Nothing to do; a stale snapshot is dropped on the next successful write.
  }
}

/** Snapshots older than this are treated as a finished night, not a crash. */
export const SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function isSnapshotUsable(snapshot: StoredSnapshot | null): boolean {
  if (!snapshot) return false;
  return Date.now() - snapshot.savedAt < SNAPSHOT_MAX_AGE_MS;
}

/**
 * Which copy to trust. The snapshot only wins when it holds strictly more
 * progress than the server, which is what an interrupted PATCH looks like.
 * Equal or lesser progress means the server already has it.
 */
export function snapshotIsAhead(
  snapshot: StoredSnapshot | null,
  serverLive: LiveGameState | null
): boolean {
  if (!isSnapshotUsable(snapshot)) return false;
  if (!serverLive) return true;
  const local = snapshot as StoredSnapshot;
  if (local.live.answeredKeys.length > serverLive.answeredKeys.length) return true;
  if (local.live.adjustmentLog.length > serverLive.adjustmentLog.length) return true;
  const localTotal = sumScores(local.live.scores);
  const serverTotal = sumScores(serverLive.scores);
  return localTotal !== serverTotal && local.live.answeredKeys.length >= serverLive.answeredKeys.length;
}

function sumScores(scores: Record<string, number>): number {
  return Object.values(scores).reduce((sum, n) => sum + (n || 0), 0);
}

/**
 * Which public quiz is being played, if any. Kept in sessionStorage so a
 * refresh mid-quiz reopens the same board instead of bouncing the host back to
 * the quiz list, which is what happened when this only lived in memory.
 */
const PUBLIC_PLAY_KEY = "jeoparty:public-play";

export function rememberPublicPlay(quizId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (quizId) window.sessionStorage.setItem(PUBLIC_PLAY_KEY, quizId);
    else window.sessionStorage.removeItem(PUBLIC_PLAY_KEY);
  } catch {
    // Without it, a refresh falls back to the user's own active quiz.
  }
}

export function readPublicPlay(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(PUBLIC_PLAY_KEY);
  } catch {
    return null;
  }
}
