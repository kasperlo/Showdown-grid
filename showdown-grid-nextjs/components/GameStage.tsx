"use client";

import { GameBoard } from "@/components/GameBoard";
import { GameTopBar } from "@/components/GameTopBar";
import { RoundDock } from "@/components/RoundDock";
import { Standings } from "@/components/Standings";
import { usePresentationMode } from "@/hooks/usePresentationMode";
import { useBoardGeometry } from "@/hooks/useBoardGeometry";
import { boardGeometryCssVars } from "@/utils/board-geometry";
import { useGameStore } from "@/utils/store";
import type { CSSProperties } from "react";

/**
 * Playing a quiz, on one screen.
 *
 * The rows add up to exactly the viewport, so nothing has to be scrolled to
 * while a room is watching. The bottom row is always 128px — reserved
 * whether or not it currently holds anything — so the board's height never
 * changes when a round starts or ends; it used to change twice per
 * question. See docs/superpowers/specs/2026-09-18-redesign-spillmodus.md,
 * "Del 1", for the full derivation.
 *
 * The board is not flex-1: it is sized exactly by computeBoardGeometry, and
 * the row that holds it and the standings panel centers them with
 * justify-content, so leftover space lands symmetrically in the outer
 * margin instead of pooling between the two.
 */
export function GameStage() {
  const presentation = usePresentationMode();
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  const isQuestionOpen = useGameStore((s) => s.isQuestionOpen);
  const categoryCount = useGameStore((s) => s.categories.length);
  const maxRows = useGameStore((s) =>
    s.categories.reduce((most, c) => Math.max(most, c.questions.length), 0)
  );

  const geometry = useBoardGeometry(categoryCount, maxRows);
  const geometryVars = boardGeometryCssVars(geometry) as CSSProperties;

  const dockHasTheFloor = Boolean(lastQuestion && !isQuestionOpen);

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

      {/* Always 128px, whether it holds the standings row, the round dock,
          or nothing — that constant height is what keeps the board above
          it from resizing when a round starts or ends. */}
      <div className="h-32 shrink-0 overflow-y-auto border-t border-border/60 bg-background/40 px-3 py-2 backdrop-blur sm:px-6">
        {!geometry.panelBeside && !dockHasTheFloor && (
          <Standings layout="row" />
        )}
        {/* Always mounted, and outside the conditional chrome: it owns the emoji
            burst, which is fixed-position and has to outlive the round it
            celebrates. */}
        <RoundDock />
      </div>
    </main>
  );
}
