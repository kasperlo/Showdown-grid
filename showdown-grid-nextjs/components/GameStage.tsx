"use client";

import { GameBoard } from "@/components/GameBoard";
import { GameTopBar } from "@/components/GameTopBar";
import { RoundDock } from "@/components/RoundDock";
import { Standings } from "@/components/Standings";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePresentationMode } from "@/hooks/usePresentationMode";
import { useGameStore } from "@/utils/store";

/**
 * Playing a quiz, on one screen.
 *
 * The rows add up to exactly the viewport, so nothing has to be scrolled to
 * while a room is watching. Measured before this existed: at 1920x1080 the page
 * was 1622px tall and the standings began 21px below the fold.
 *
 * Where there is room, the standings are a column to the right of the board and
 * the dock gets the bottom row to itself — so the scores stay up while points
 * are handed out. Below that width there is one bottom row, and the dock takes
 * it over for the length of a round; the dock lists every team with its score,
 * so the room loses nothing while it has the floor.
 */
/** Width a column of tiles needs before it stops being readable from a room. */
const COMFORTABLE_COLUMN = 150;
/** The standings panel plus the page's own padding and the gap between them. */
const PANEL_AND_GUTTERS = 392;

export function GameStage() {
  const presentation = usePresentationMode();
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  const isQuestionOpen = useGameStore((s) => s.isQuestionOpen);
  const categoryCount = useGameStore((s) => s.categories.length);

  // The threshold follows the board, not a fixed breakpoint. A four-category
  // board leaves room for the panel from about 1030px; a seven-category one
  // does not until about 1515px, and forcing the panel in before then squeezed
  // the columns below the width where a room can read them.
  const beside = Math.max(
    1024,
    categoryCount * COMFORTABLE_COLUMN +
      Math.max(0, categoryCount - 1) * 12 +
      PANEL_AND_GUTTERS
  );
  const hasRoomBeside = useMediaQuery(`(min-width: ${beside}px)`);

  const dockHasTheFloor = Boolean(lastQuestion && !isQuestionOpen);
  // With the standings in the column there is nothing for the bottom row to
  // hold between questions, and an empty bordered strip is worse than no row.
  const bottomRowHasContent = dockHasTheFloor || !hasRoomBeside;

  return (
    <main className="stage flex h-dvh flex-col overflow-hidden">
      <GameTopBar presentation={presentation} />

      <div className="flex min-h-0 flex-1 gap-4 px-3 py-2 sm:px-6 sm:py-3">
        <section className="group/board flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <GameBoard />
        </section>

        {hasRoomBeside && (
          <div className="w-72 shrink-0 xl:w-80">
            <Standings layout="column" />
          </div>
        )}
      </div>

      <div
        className={
          bottomRowHasContent
            ? "max-h-[45vh] shrink-0 overflow-y-auto border-t border-border/60 bg-background/40 px-3 py-2 backdrop-blur sm:px-6"
            : "shrink-0"
        }
      >
        {!hasRoomBeside && !dockHasTheFloor && <Standings layout="row" />}
        {/* Always mounted, and outside the conditional chrome: it owns the emoji
            burst, which is fixed-position and has to outlive the round it
            celebrates. */}
        <RoundDock />
      </div>
    </main>
  );
}
