"use client";

import { useMemo, useState } from "react";
import { useGameStore } from "@/utils/store";
import type { Team } from "@/utils/types";
import { Crown, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamAdjustmentModal } from "./TeamAdjustmentModal";
import { AddTeamInline } from "./AddTeamInline";
import { rankTeams } from "@/utils/ranking";

/**
 * The standings, as one horizontal row under the board.
 *
 * This used to be a tall panel below the board, which put it under the fold on
 * every screen the quiz is actually hosted on — at 1920x1080 it started 20px
 * past the bottom edge. The scores are the one thing the room asks about
 * between questions, so they have to share the screen with the board rather
 * than take turns with it.
 */
export function StandingsBar() {
  const teams = useGameStore((state) => state.teams);
  const currentTurnTeamId = useGameStore((state) => state.currentTurnTeamId);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [adding, setAdding] = useState(false);

  const ranked = useMemo(() => rankTeams(teams), [teams]);

  if (!teams.length) {
    return (
      <div className="mx-auto flex max-w-md items-center gap-3">
        <span className="shrink-0 text-sm font-semibold text-muted-foreground">
          Lag
        </span>
        <AddTeamInline autoFocus />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <ol className="flex min-w-0 flex-1 flex-wrap items-stretch justify-center gap-2">
          {ranked.map((team) => {
            const isLeader = team.rank === 1 && team.score > 0;
            const hasTurn = team.id === currentTurnTeamId;

            return (
              <li
                key={team.id}
                className="min-w-0 max-w-[20rem] flex-1 basis-36 sm:basis-56"
              >
                <button
                  type="button"
                  onClick={() =>
                    setSelectedTeam(teams.find((t) => t.id === team.id) ?? null)
                  }
                  title={`Juster poeng eller endre navn for ${team.name}`}
                  className={`tile flex h-full w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-accent/10 ${
                    hasTurn ? "ring-2 ring-accent" : ""
                  }`}
                >
                  <span className="shrink-0 text-xs font-bold text-muted-foreground tabular-nums sm:text-[clamp(0.7rem,1.7vh,1rem)]">
                    {team.rank}
                  </span>

                  {isLeader && (
                    <Crown
                      className="h-4 w-4 shrink-0 text-accent"
                      aria-label="Leder"
                    />
                  )}

                  <span className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-[clamp(0.8rem,2vh,1.35rem)]">
                    {team.name}
                  </span>

                  <span className="shrink-0 text-lg font-extrabold text-accent tabular-nums sm:text-[clamp(1.1rem,3.4vh,2.25rem)]">
                    {team.score}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-2"
          onClick={() => setAdding((open) => !open)}
          aria-expanded={adding}
          title="Legg til et lag som kom for sent"
        >
          <UserPlus className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">Lag</span>
        </Button>
      </div>

      {adding && (
        <div className="mt-2 max-w-md">
          <AddTeamInline autoFocus />
        </div>
      )}

      <TeamAdjustmentModal
        team={selectedTeam}
        onClose={() => setSelectedTeam(null)}
      />
    </>
  );
}
