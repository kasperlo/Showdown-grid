import type { Category, CategorySummary, TeamResult } from "@/utils/types";
import { isAnsweredIn, legacyAnsweredKey, withCategoryIds } from "@/utils/quiz-template";

/**
 * What a finished run stores about itself, worked out from the live state the
 * client sends and the quiz as it is when the run is completed.
 */

export function readAnsweredKeys(finalState: unknown): string[] {
  if (!finalState || typeof finalState !== "object") return [];
  const raw = finalState as Record<string, unknown>;
  if (Array.isArray(raw.answeredKeys)) {
    return raw.answeredKeys.filter((k): k is string => typeof k === "string");
  }
  // Legacy shape: whole board in the run.
  if (Array.isArray(raw.categories)) {
    const keys: string[] = [];
    (raw.categories as { name?: string; questions?: { answered?: boolean }[] }[]).forEach(
      (category) => {
        (category.questions ?? []).forEach((question, index) => {
          if (question?.answered) keys.push(legacyAnsweredKey(String(category.name), index));
        });
      }
    );
    return keys;
  }
  return [];
}

/** Answered cards per category. Categories get the same ids the app gives
 * them on load, so keys written by id and by name both count. */
export function buildCategorySummary(
  quizData: unknown,
  answeredKeys: string[]
): CategorySummary[] {
  if (!quizData || typeof quizData !== "object") return [];
  const raw = (quizData as { categories?: unknown }).categories;
  if (!Array.isArray(raw)) return [];

  const answered = new Set(answeredKeys);
  const categories = withCategoryIds(
    raw.map((category) => {
      const c = (category ?? {}) as Partial<Category>;
      return {
        id: typeof c.id === "string" ? c.id : undefined,
        name: String(c.name ?? "Uten navn"),
        questions: Array.isArray(c.questions) ? c.questions : [],
      };
    }),
    "positional"
  );

  return categories.map((category) => {
    let answeredCount = 0;
    category.questions.forEach((_, index) => {
      if (isAnsweredIn(answered, category, index)) answeredCount += 1;
    });
    return { name: category.name, total: category.questions.length, answered: answeredCount };
  });
}

export interface CompletingTeam {
  id: string;
  name: string;
  score: number;
  players?: string[];
}

export function rankRunTeams(teams: CompletingTeam[]): TeamResult[] {
  const sorted = [...teams].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name, "nb");
  });

  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((team, index) => {
    const rank = lastScore === null || team.score < lastScore ? index + 1 : lastRank;
    lastScore = team.score;
    lastRank = rank;
    return {
      teamId: team.id,
      teamName: team.name,
      finalScore: team.score,
      rank,
      players: Array.isArray(team.players)
        ? team.players.filter((p): p is string => typeof p === "string")
        : [],
    };
  });
}

/** "Lag A" or, for a shared first place, "Lag A og Lag B". */
export function winnerLabel(ranked: TeamResult[]): string | null {
  const winners = ranked.filter((team) => team.rank === 1).map((team) => team.teamName);
  if (!winners.length) return null;
  if (winners.length === 1) return winners[0];
  return `${winners.slice(0, -1).join(", ")} og ${winners[winners.length - 1]}`;
}

const CLOCK_SKEW_MS = 10 * 60 * 1000;

/**
 * When the game ended: the last thing that happened on the board, not the
 * moment someone pressed "Fullfør", which can be the next day. Falls back to
 * now when the client did not say, or said something impossible.
 */
export function playedWindow(
  startedAt: string,
  lastActionAt: unknown,
  now: Date
): { endedAt: Date; durationSeconds: number } {
  const start = new Date(startedAt).getTime();
  const last = typeof lastActionAt === "number" ? lastActionAt : NaN;
  // Both times come from the host's clock, which may run a little ahead of
  // the server's.
  const plausible =
    Number.isFinite(last) &&
    Number.isFinite(start) &&
    last >= start &&
    last <= now.getTime() + CLOCK_SKEW_MS;
  const endedAt = plausible ? new Date(last) : now;
  const durationSeconds = Number.isFinite(start)
    ? Math.max(0, Math.round((endedAt.getTime() - start) / 1000))
    : 0;
  return { endedAt, durationSeconds };
}
