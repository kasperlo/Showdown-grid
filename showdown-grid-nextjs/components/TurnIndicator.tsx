"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useGameStore } from "@/utils/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const Confetti = dynamic(() => import("./Confetti"), { ssr: false });

/**
 * Whose turn it is, as a pill that fits on the top bar.
 *
 * It used to be a 72px block of its own between the title and the board. On a
 * projector that is 72px the board does not get, for one line of text — so it
 * moved onto the bar beside the title.
 */
export function TurnIndicator({
  variant = "pill",
}: {
  variant?: "pill" | "panel";
}) {
  const teams = useGameStore((state) => state.teams);
  const currentTurnTeamId = useGameStore((state) => state.currentTurnTeamId);
  const isInitialTurnSelection = useGameStore(
    (state) => state.isInitialTurnSelection,
  );
  const turnRule = useGameStore((state) => state.turnRule);
  const initializeTurn = useGameStore((state) => state.initializeTurn);

  const [showConfetti, setShowConfetti] = useState(false);
  const [spinningTeamIndex, setSpinningTeamIndex] = useState(0);

  useEffect(() => {
    if (!isInitialTurnSelection || teams.length === 0) return;

    const interval = setInterval(() => {
      setSpinningTeamIndex((prev) => (prev + 1) % teams.length);
    }, 100);

    return () => clearInterval(interval);
  }, [isInitialTurnSelection, teams.length]);

  // Celebrate when the draw lands. A timer of its own here never fired: the
  // store ends the draw at the same 3 s mark, and that unmounted the timer.
  useEffect(
    () =>
      useGameStore.subscribe((state, previous) => {
        if (
          previous.isInitialTurnSelection &&
          !state.isInitialTurnSelection &&
          state.currentTurnTeamId
        ) {
          setShowConfetti(true);
        }
      }),
    [],
  );

  if (!teams.length) return null;

  if (!currentTurnTeamId && !isInitialTurnSelection) {
    return (
      <Button
        onClick={initializeTurn}
        size={variant === "panel" ? "default" : "sm"}
        className={
          variant === "panel"
            ? "w-full bg-gradient-to-r from-accent/90 to-primary/90 font-semibold hover:from-accent hover:to-primary"
            : "shrink-0 bg-gradient-to-r from-accent/90 to-primary/90 font-semibold hover:from-accent hover:to-primary"
        }
      >
        Hvem skal starte?
      </Button>
    );
  }

  const currentIndex = currentTurnTeamId
    ? teams.findIndex((t) => t.id === currentTurnTeamId)
    : -1;
  const currentTeam = currentIndex >= 0 ? teams[currentIndex] : null;
  const nextTeam =
    currentIndex >= 0 && teams.length > 1
      ? teams[(currentIndex + 1) % teams.length]
      : null;

  const displayTeam = isInitialTurnSelection
    ? teams[spinningTeamIndex % teams.length]
    : currentTeam;

  if (!displayTeam) return null;

  const confetti = showConfetti && (
    <Confetti show={showConfetti} onComplete={() => setShowConfetti(false)} />
  );

  if (variant === "panel") {
    return (
      <>
        {confetti}
        <div
          className={cn(
            "mt-2 shrink-0 rounded-xl border border-accent bg-gradient-to-r from-accent/20 to-primary/20 px-3 py-2 text-center",
            !isInitialTurnSelection && currentTeam && "turn-highlight",
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {isInitialTurnSelection ? "Trekker lag …" : "Det er turen til"}
          </p>
          <p className="truncate text-2xl font-extrabold text-accent">
            {displayTeam.name}
          </p>
          {!isInitialTurnSelection && (
            <p className="truncate text-[11px] text-muted-foreground">
              {turnRule === "rotation"
                ? nextTeam
                  ? `Deretter: ${nextTeam.name}`
                  : "Lagene velger etter tur"
                : "Riktig svar gir turen"}
            </p>
          )}
          <span className="sr-only">
            {isInitialTurnSelection ? "velger lag" : "har turen"}
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      {confetti}

      <div
        className={cn(
          "inline-flex min-w-0 shrink items-center gap-2 rounded-full px-3 py-1",
          "border border-accent bg-gradient-to-r from-accent/20 to-primary/20",
          !isInitialTurnSelection && currentTeam && "turn-highlight",
        )}
        title={
          turnRule === "rotation"
            ? "Lagene velger etter tur"
            : "Laget som svarer riktig, velger neste kort"
        }
      >
        <span aria-hidden>👉</span>
        <span className="truncate text-[clamp(0.85rem,2.2vh,1.4rem)] font-bold text-accent">
          {displayTeam.name}
        </span>
        <span className="sr-only">
          {isInitialTurnSelection ? "velger lag" : "har turen"}
        </span>
      </div>
    </>
  );
}
