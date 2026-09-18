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
  const initializeTurn = useGameStore((state) => state.initializeTurn);

  const [showConfetti, setShowConfetti] = useState(false);
  const [spinningTeamIndex, setSpinningTeamIndex] = useState(0);

  useEffect(() => {
    if (!isInitialTurnSelection || teams.length === 0) return;

    const interval = setInterval(() => {
      setSpinningTeamIndex((prev) => (prev + 1) % teams.length);
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setShowConfetti(true);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isInitialTurnSelection, teams.length]);

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

  const currentTeam = currentTurnTeamId
    ? teams.find((t) => t.id === currentTurnTeamId)
    : null;

  const displayTeam = isInitialTurnSelection
    ? teams[spinningTeamIndex]
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
            Det er turen til
          </p>
          <p className="truncate text-2xl font-extrabold text-accent">
            {displayTeam.name}
          </p>
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
