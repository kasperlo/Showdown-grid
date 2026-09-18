import type { LiveGameState } from "./types";

/**
 * A session only counts as "in progress" once something in it happened — at
 * least one card marked answered, or at least one score away from 0 (a
 * manual adjustment can move a score without marking a card played). An
 * empty run — created the moment a quiz opens, before anyone has clicked
 * anything — resumes silently instead of prompting a host who never left
 * anything behind.
 */
export function hasSessionProgress(live: LiveGameState | null): boolean {
  if (!live) return false;
  if (live.answeredKeys.length > 0) return true;
  return Object.values(live.scores).some((score) => score !== 0);
}
