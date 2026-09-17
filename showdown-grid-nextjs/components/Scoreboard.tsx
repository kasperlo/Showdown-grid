"use client";

import { useMemo, useState } from "react";
import { useGameStore } from "@/utils/store";
import type { Team } from "@/utils/types";
import { Crown, Medal, Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddTeamInline } from "./AddTeamInline";
import { TeamAdjustmentModal } from "./TeamAdjustmentModal";
import { rankTeams } from "@/utils/ranking";

/**
 * The scoreboard. It used to show rank, name and a trophy but not the score,
 * which is the one number everyone in the room is asking about.
 */
export function Scoreboard() {
  const teams = useGameStore((state) => state.teams);
  const currentTurnTeamId = useGameStore((state) => state.currentTurnTeamId);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [adding, setAdding] = useState(false);

  const ranked = useMemo(() => rankTeams(teams), [teams]);
  const leaderScore = ranked[0]?.score ?? 0;

  if (!teams.length) {
    return (
      <div className="glass space-y-3 rounded-2xl p-6">
        <h2 className="text-2xl font-bold tracking-wide text-accent">Lag</h2>
        <AddTeamInline autoFocus />
      </div>
    );
  }

  return (
    <div className="glass w-full rounded-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-2xl font-bold tracking-wide text-accent">Stilling</h2>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => setAdding((open) => !open)}
          aria-expanded={adding}
          title="Legg til et lag som kom for sent"
        >
          <UserPlus className="h-4 w-4" />
          Lag
        </Button>
      </div>

      {adding && (
        <div className="mb-4">
          <AddTeamInline autoFocus />
        </div>
      )}

      <ol className="space-y-2">
        {ranked.map((team) => {
          const isLeader = team.rank === 1 && leaderScore > 0;
          const share =
            leaderScore > 0
              ? Math.max(0, Math.min(100, (team.score / leaderScore) * 100))
              : 0;

          return (
            <li key={team.id}>
              <button
                type="button"
                onClick={() =>
                  setSelectedTeam(teams.find((t) => t.id === team.id) ?? null)
                }
                title={`Juster poeng eller endre navn for ${team.name}`}
                className={`tile group relative flex w-full items-center gap-3 overflow-hidden p-3 text-left transition-colors hover:bg-accent/10 ${
                  team.id === currentTurnTeamId ? "ring-2 ring-accent" : ""
                }`}
              >
                {/* A bar rather than a chart: it reads at a glance from across
                    the room, which is where this is actually looked at. */}
                <span
                  className="absolute inset-y-0 left-0 bg-accent/10"
                  style={{ width: `${share}%` }}
                  aria-hidden
                />

                <span className="relative w-7 shrink-0 text-center text-xl font-bold text-muted-foreground tabular-nums">
                  {team.rank}
                </span>

                <span className="relative min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {team.name}
                  </span>
                  {team.players.length > 0 && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {team.players.filter(Boolean).join(", ")}
                    </span>
                  )}
                </span>

                {isLeader && (
                  <Crown className="relative h-5 w-5 shrink-0 text-accent" aria-label="Leder" />
                )}
                {team.rank === 2 && (
                  <Medal className="relative h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                {team.rank === 3 && (
                  <Medal className="relative h-5 w-5 shrink-0 text-secondary" aria-hidden />
                )}

                <span className="relative shrink-0 text-xl font-bold tabular-nums text-accent sm:text-2xl">
                  {team.score}
                </span>
                <Pencil className="relative h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>

      <TeamAdjustmentModal
        team={selectedTeam}
        onClose={() => setSelectedTeam(null)}
      />
    </div>
  );
}
