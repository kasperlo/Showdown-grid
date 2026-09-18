"use client";

import { useMemo, useState } from "react";
import { useGameStore } from "@/utils/store";
import type { Team } from "@/utils/types";
import {
  Crown,
  MoreHorizontal,
  RotateCcw,
  Shuffle,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamAdjustmentModal } from "./TeamAdjustmentModal";
import { AddTeamInline } from "./AddTeamInline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { rankTeams } from "@/utils/ranking";
import { TurnIndicator } from "./TurnIndicator";

/**
 * The standings, as a column beside the board where there is room and as a
 * single scrolling row where there is not.
 *
 * Two earlier shapes were wrong for different reasons. A tall panel under the
 * board put the scores below the fold on every screen the quiz is hosted on. A
 * wrapping row of pills fitted, but eight teams became two rows of cramped
 * chips with clipped names — it read as a bookmarks bar, not a scoreboard.
 *
 * The column wins wherever it fits: it uses the empty margin beside a
 * four-category board, and it gives every team a full-width row with a score
 * big enough to read from the back of the room.
 */
export function Standings({ layout }: { layout: "column" | "row" }) {
  const teams = useGameStore((state) => state.teams);
  const currentTurnTeamId = useGameStore((state) => state.currentTurnTeamId);
  const initializeTurn = useGameStore((state) => state.initializeTurn);
  const resetGame = useGameStore((state) => state.resetGame);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const totalScore = teams.reduce((sum, team) => sum + team.score, 0);

  const ranked = useMemo(() => rankTeams(teams), [teams]);
  const isColumn = layout === "column";

  if (!teams.length) {
    return (
      <div
        className={
          isColumn ? "space-y-2" : "mx-auto flex max-w-md items-center gap-3"
        }
      >
        <span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Lag
        </span>
        <AddTeamInline autoFocus />
      </div>
    );
  }

  const hostMenu = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-muted-foreground"
            title="Trekk startlag på nytt, eller nullstill spillet"
            aria-label="Flere valg"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={() => initializeTurn()}>
            <Shuffle className="mr-2 h-4 w-4" />
            Trekk startlag på nytt
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setConfirmReset(true)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Nullstill spillet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nullstille spillet?</AlertDialogTitle>
            <AlertDialogDescription>
              {totalScore !== 0
                ? `Til sammen ${totalScore} poeng blir satt til 0. `
                : ""}
              Alle spørsmål blir spillbare igjen, og økten lagres i historikken
              slik den står nå. Kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => resetGame()}
            >
              Nullstill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  const rows = ranked.map((team) => {
    const isLeader = team.rank === 1 && team.score > 0;
    const hasTurn = team.id === currentTurnTeamId;

    return (
      <li
        key={team.id}
        className={
          isColumn
            ? "standings-row flex-[1_1_0] min-h-[76px] max-h-[164px]"
            : "standings-row min-w-0 shrink-0 basis-52"
        }
      >
        <button
          type="button"
          onClick={() =>
            setSelectedTeam(teams.find((t) => t.id === team.id) ?? null)
          }
          title={`Juster poeng eller endre navn for ${team.name}`}
          className={`tile flex w-full items-center gap-2.5 px-3 text-left transition-colors hover:bg-accent/10 ${
            isColumn ? "py-3" : "h-full py-2.5"
          } ${hasTurn ? "ring-2 ring-accent" : ""}`}
        >
          <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground tabular-nums sm:text-[clamp(0.7rem,1.8vh,1.05rem)]">
            {team.rank}
          </span>

          {isLeader && (
            <Crown className="h-4 w-4 shrink-0 text-accent" aria-label="Leder" />
          )}

          <span className="standings-row-name min-w-0 flex-1 truncate text-sm font-semibold">
            {team.name}
          </span>

          <span className="standings-row-score shrink-0 font-extrabold text-accent tabular-nums">
            {team.score}
          </span>
        </button>
      </li>
    );
  });

  if (isColumn) {
    return (
      <>
        <aside className="glass flex h-full min-h-0 flex-col gap-2 rounded-2xl p-3">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Stilling
            </h2>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-muted-foreground"
                onClick={() => setAdding((open) => !open)}
                aria-expanded={adding}
                title="Legg til et lag som kom for sent"
              >
                <UserPlus className="h-4 w-4" />
                Lag
              </Button>
              {hostMenu}
            </div>
          </div>

          {adding && (
            <div className="shrink-0">
              <AddTeamInline autoFocus />
            </div>
          )}

          <ol className="flex min-h-0 flex-1 flex-col justify-center gap-2 overflow-y-auto pr-0.5">
            {rows}
          </ol>

          <TurnIndicator variant="panel" />
        </aside>

        <TeamAdjustmentModal
          team={selectedTeam}
          onClose={() => setSelectedTeam(null)}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* One row that scrolls sideways rather than wrapping: wrapping is what
            produced the two rows of cramped chips. */}
        <ol className="flex min-w-0 flex-1 items-stretch gap-2 overflow-x-auto pb-0.5">
          {rows}
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
        {hostMenu}
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
