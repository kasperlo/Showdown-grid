"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useGameStore } from "@/utils/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Lazy load Confetti to reduce initial bundle size
const Confetti = dynamic(() => import("./Confetti"), { ssr: false });

export function TurnIndicator() {
  const teams = useGameStore((state) => state.teams);
  const currentTurnTeamId = useGameStore((state) => state.currentTurnTeamId);
  const isInitialTurnSelection = useGameStore((state) => state.isInitialTurnSelection);
  const initializeTurn = useGameStore((state) => state.initializeTurn);

  const [showConfetti, setShowConfetti] = useState(false);
  const [spinningTeamIndex, setSpinningTeamIndex] = useState(0);

  // Spinner animation effect
  useEffect(() => {
    if (!isInitialTurnSelection) return;

    // Rapid rotation through teams for 3 seconds
    const interval = setInterval(() => {
      setSpinningTeamIndex((prev) => (prev + 1) % teams.length);
    }, 100);

    // Stop after 3 seconds and trigger confetti
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setShowConfetti(true);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isInitialTurnSelection, teams.length]);

  // If no teams exist, don't render anything
  if (!teams.length) return null;

  // If no current turn selected and not spinning, show "Start" button
  if (!currentTurnTeamId && !isInitialTurnSelection) {
    return (
      <div className="mb-6">
        <Button
          onClick={initializeTurn}
          size="lg"
          className="text-lg px-8 py-6 bg-gradient-to-r from-accent/90 to-primary/90 hover:from-accent hover:to-primary"
        >
          Hvem skal starte?
        </Button>
      </div>
    );
  }

  const currentTeam = currentTurnTeamId
    ? teams.find((t) => t.id === currentTurnTeamId)
    : null;

  const displayTeam = isInitialTurnSelection
    ? teams[spinningTeamIndex]
    : currentTeam;

  if (!displayTeam) return null;

  return (
    <>
      {showConfetti && (
        <Confetti
          show={showConfetti}
          onComplete={() => setShowConfetti(false)}
        />
      )}

      <div className="mb-6 relative inline-block">
        <div
          className={cn(
            "inline-flex items-center gap-3 px-6 py-3 rounded-full",
            "bg-gradient-to-r from-accent/20 to-primary/20",
            "border-2 border-accent",
            "backdrop-blur-sm",
            !isInitialTurnSelection && currentTeam && "turn-highlight"
          )}
        >
          <span className="text-2xl">👉</span>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {isInitialTurnSelection ? "Velger lag..." : "Det er din tur"}
            </span>
            <span className="text-2xl font-bold text-accent">
              {displayTeam.name}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

