"use client";

import { useMemo, useState } from "react";
import { useGameStore } from "@/utils/store";
import type { Team } from "@/utils/types";
import {
  Crown,
  MoreHorizontal,
  RotateCcw,
  Shuffle,
  Undo2,
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
  const isDrawing = useGameStore((state) => state.isInitialTurnSelection);
  const initializeTurn = useGameStore((state) => state.initializeTurn);
  const resetGame = useGameStore((state) => state.resetGame);
  const lastCompletedRound = useGameStore((state) => state.lastCompletedRound);
  const undoLastCard = useGameStore((state) => state.undoLastCard);
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
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem
            disabled={!lastCompletedRound}
            onClick={() => undoLastCard()}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            {lastCompletedRound
              ? `Angre forrige kort (${lastCompletedRound.categoryName} ${lastCompletedRound.points})`
              : "Angre forrige kort"}
          </DropdownMenuItem>
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
              onClick={() => void resetGame()}
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
    // While the starting team is being drawn, no row is marked: the old turn
    // stayed lit for three seconds next to a spinner naming other teams.
    const hasTurn = !isDrawing && team.id === currentTurnTeamId;

    return (
      <li
        key={team.id}
        className={`${
          isColumn
            ? "standings-row flex-[1_1_0] min-h-[76px] max-h-[164px]"
            : // container-type: size (in .standings-row) strips this li's
              // content-based auto height, so unlike the column layout it
              // needs an explicit height to contain against.
              "standings-row h-11 min-w-0 shrink-0 basis-52"
        } ${hasTurn ? "ring-2 ring-accent" : ""}`}
      >
        <button
          type="button"
          onClick={() =>
            setSelectedTeam(teams.find((t) => t.id === team.id) ?? null)
          }
          title={`Juster poeng eller endre navn for ${team.name}`}
          className={`tile flex h-full w-full px-3 text-left transition-colors hover:bg-accent/10 ${
            isColumn
              ? "flex-col justify-center gap-0.5 py-2"
              : "items-center gap-2.5 py-2.5"
          }`}
        >
          {/* In the column the name gets a line of its own: beside a score
              sized for the back of the room, a leader on four digits was
              left with one letter of its name. */}
          <span className="flex w-full min-w-0 items-center gap-2">
            {isLeader && (
              <Crown className="h-4 w-4 shrink-0 text-accent" aria-label="Leder" />
            )}
            <span className="standings-row-name min-w-0 flex-1 truncate font-semibold">
              {team.name}
            </span>
          </span>

          <span
            className={`standings-row-score shrink-0 font-extrabold leading-none text-accent tabular-nums ${
              isColumn ? "self-end" : ""
            }`}
          >
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

          {/* "safe center" (inline: no justify-safe-center in Tailwind v3)
              falls back to start-aligned once rows overflow, so the
              top-ranked row stays scrollable into view. */}
          {/* The padding keeps the turn ring, which is drawn outside the
              row, inside the scroll box that would otherwise clip it. */}
          <ol
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-0.5"
            style={{ justifyContent: "safe center" }}
          >
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
        <ol className="flex min-w-0 flex-1 items-stretch gap-2 overflow-x-auto p-0.5">
          {rows}
        </ol>
        <TurnIndicator />
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
