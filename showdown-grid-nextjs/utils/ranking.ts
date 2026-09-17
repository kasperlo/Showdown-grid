import type { Team } from "./types";

export interface RankedTeam {
  id: string;
  name: string;
  score: number;
  players: string[];
  /** Competition ranking: two teams on the same score share a place (1, 1, 3). */
  rank: number;
}

/**
 * Sorted by score, then by name so a tie always renders in the same order.
 * Used by the scoreboard, the results podium and the server when a run is
 * completed, so all three agree on who won.
 */
export function rankTeams(
  teams: Pick<Team, "id" | "name" | "score" | "players">[]
): RankedTeam[] {
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
      id: team.id,
      name: team.name,
      score: team.score,
      players: team.players ?? [],
      rank,
    };
  });
}
