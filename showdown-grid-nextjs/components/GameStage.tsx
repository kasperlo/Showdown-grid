"use client";

import { GameBoard } from "@/components/GameBoard";
import { GameTopBar } from "@/components/GameTopBar";
import { RoundScreen } from "@/components/round/RoundScreen";
import { Standings } from "@/components/Standings";
import { usePresentationMode } from "@/hooks/usePresentationMode";
import { useBoardGeometry } from "@/hooks/useBoardGeometry";
import { boardGeometryCssVars } from "@/utils/board-geometry";
import { useGameStore } from "@/utils/store";
import type { CSSProperties } from "react";

/**
 * Playing a quiz, on one screen — until a round starts, when RoundScreen
 * takes the whole page instead. The board's state lives in the store, so
 * unmounting it here for the length of a round is safe: it's exactly the
 * same tree when the round ends.
 */
export function GameStage() {
  const presentation = usePresentationMode();
  const roundStep = useGameStore((s) => s.roundStep);
  const categoryCount = useGameStore((s) => s.categories.length);
  const maxRows = useGameStore((s) =>
    s.categories.reduce((most, c) => Math.max(most, c.questions.length), 0)
  );

  const geometry = useBoardGeometry(categoryCount, maxRows);
  const geometryVars = boardGeometryCssVars(geometry) as CSSProperties;

  if (roundStep) {
    return <RoundScreen />;
  }

  return (
    <main className="stage flex h-dvh flex-col overflow-hidden">
      <GameTopBar presentation={presentation} />

      <div
        className="flex min-h-0 flex-1 justify-center gap-5 px-3 py-2 sm:px-6 sm:py-3"
        style={geometryVars}
      >
        <section className="min-h-0 min-w-0 overflow-y-auto">
          <GameBoard />
        </section>

        {geometry.panelBeside && (
          <div className="flex-[0_0_var(--panel-w)]">
            <Standings layout="column" />
          </div>
        )}
      </div>

      {/* Always 128px, holding the standings row or nothing — a round no
          longer lives down here, so the only remaining job of this row is
          the narrow-layout standings. It stays constant height either way,
          per Del 1. */}
      <div className="h-32 shrink-0 overflow-y-auto border-t border-border/60 bg-background/40 px-3 py-2 backdrop-blur sm:px-6">
        {!geometry.panelBeside && <Standings layout="row" />}
      </div>
    </main>
  );
}
