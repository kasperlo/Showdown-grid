"use client";

import { GameBoard } from "@/components/GameBoard";
import { GameTopBar } from "@/components/GameTopBar";
import { RoundDock } from "@/components/RoundDock";
import { StandingsBar } from "@/components/StandingsBar";
import { usePresentationMode } from "@/hooks/usePresentationMode";
import { useGameStore } from "@/utils/store";

/**
 * Playing a quiz, on one screen.
 *
 * Three rows that add up to exactly the viewport: bar, board, standings. The
 * board takes whatever the other two leave, so nothing has to be scrolled to
 * while a room is watching. Measured before this existed: at 1920x1080 the page
 * was 1622px tall and the standings began 21px below the fold.
 *
 * The bottom row holds the standings between questions and the scoring dock
 * during a round — never both. The dock lists every team with its score, so the
 * room loses nothing while it is up, and the two no longer overlap.
 */
export function GameStage() {
  const presentation = usePresentationMode();
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  const isQuestionOpen = useGameStore((s) => s.isQuestionOpen);

  const dockHasTheFloor = Boolean(lastQuestion && !isQuestionOpen);

  return (
    <main className="stage flex h-dvh flex-col overflow-hidden">
      <GameTopBar presentation={presentation} />

      <section className="group/board flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2 sm:px-6 sm:py-3">
        <GameBoard />
      </section>

      <div className="max-h-[45vh] shrink-0 overflow-y-auto border-t border-border/60 bg-background/40 px-3 py-2 backdrop-blur sm:px-6">
        {!dockHasTheFloor && <StandingsBar />}
        {/* Always mounted: it owns the emoji burst, which has to outlive the
            round it celebrates. */}
        <RoundDock />
      </div>
    </main>
  );
}
