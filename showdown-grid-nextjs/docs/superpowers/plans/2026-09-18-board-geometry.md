# Board Geometry (Del 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flex-1/COMFORTABLE_COLUMN board sizing with the exact
formula from the spec, fix the two-height-changes-per-question bug, and ship
`utils/board-geometry.ts` as the shared geometry source Del 5 will reuse.

**Architecture:** One pure function (`computeBoardGeometry`) is the single
source of truth for every pixel value. A small reactive hook
(`useBoardGeometry`) tracks viewport width/height via `useSyncExternalStore`
(matching the codebase's existing `useMediaQuery` pattern — no
effect+setState) and turns the geometry into CSS custom properties, applied
once on an ancestor element in `GameStage`. Descendant CSS
(`.points-chip`, `.category-header-label`, the grid's own
`gridTemplateColumns`/`Rows`) reads those variables via `var()`/`calc()`, so
no pixel values are prop-drilled through components. The one place a fixed
JS-computed height genuinely cannot be known ahead of time — a standings row,
whose height depends on how many teams there are — uses a CSS container
query (`container-type: size` + `cqh`) instead, per the spec's suggestion.

**Tech Stack:** Next.js (App Router), React, Zustand, Tailwind CSS, vitest
(node environment, pure-function tests only — no component/DOM test
infrastructure exists in this repo).

**Spec:** [docs/superpowers/specs/2026-09-18-redesign-spillmodus.md](../specs/2026-09-18-redesign-spillmodus.md)
— "Del 1 — Brettets geometri" and the shared "Rekkefølge" / "Fallgruver"
sections.

## Global Constraints

- Formula constants (verbatim from spec): `BAR=51, PAD=12, SIDE=24, DOCK=128,
  GAP=12, PANELGAP=20, HEADF=0.62, ASPECT=1.9, MINCOL=140`.
- `DOCK` is **always** reserved (128px), whether or not the bottom row has
  content — this is the actual fix for "brettet endrer høyde to ganger per
  spørsmål".
- The board is **not** `flex: 1` in the row that holds board + standings; it
  is content-sized. The row gets `justify-content: center`. The standings
  panel keeps `flex: 0 0 var(--panel-w)`.
- Acceptance table (must match exactly, verified in Task 9):

  | Oppsett | Kolonne | Flis | Brett | Panel | Marg per side |
  |---|---|---|---|---|---|
  | 5 kat × 5 rader @ 1920×1080 | 271 | 271×143 | 1403 | 365 | 42 |
  | 4 kat × 5 rader @ 2560×1440 | 393 | 393×207 | 1608 | 432 | 226 |
  | 7 kat × 5 rader @ 1366×768 | 165 | 165×87 | 1227 | i bunnraden | 45 |

- Do not touch `components/QuestionModal.tsx` or `components/RoundDock.tsx`
  internals — those are replaced wholesale in Del 2. This plan only changes
  their *container* (the fixed-height dock row in `GameStage.tsx`).
- Fallgruver 4, 5, 6 (from the spec) apply directly to this part: standings
  centers with `mx-auto`/flex behavior not `justify-center` on a scroller;
  `GameBoard` keeps one grid, not per-column flex stacks; viewport tracking
  uses `useSyncExternalStore`, never an effect with `setState`.

## Assumptions (call out, not silent)

1. **Turn indicator in the narrow ("row") standings layout.** The spec says
   the turn indicator "flyttes ut av toppbaren" and describes its new home
   under the standings *column* list. It does not say what replaces it in
   the narrow/bottom-dock ("row") layout, where there's no obvious room for
   a large field. Decision: `TurnIndicator` gets a `variant?: "pill" |
   "panel"` prop; the existing compact pill (unchanged look) renders inline
   in the "row" standings layout's header, and the new large "panel" variant
   renders under the list in the "column" layout. This keeps turn visibility
   in both layouts instead of silently dropping it in the narrow case.
2. **CSS vars vs. per-element inline styles.** The spec explicitly asks for
   both a pure function *and* "CSS-variablene den produserer" — so this plan
   sets `--tile-h`, `--head-h`, `--col-w`, `--panel-w` once on an ancestor via
   `board-geometry.ts`'s `boardGeometryCssVars()` helper, and every consumer
   reads them via `var()`/`calc()`. This avoids drilling raw pixel numbers
   through `GameBoard`/`Standings` props.
3. **Container queries used only where JS can't know the size.** Tile height
   and header height are exact and known synchronously from
   `computeBoardGeometry` — no container query needed there. A standings
   row's height depends on team count and is only resolved by the browser's
   own flex layout, so that one spot genuinely needs `cqh`.

---

### Task 1: `utils/board-geometry.ts` — pure geometry function

**Files:**
- Create: `utils/board-geometry.ts`
- Test: `utils/__tests__/board-geometry.test.ts`

**Interfaces:**
- Produces: `BOARD_GEOMETRY` (constants object), `computeBoardGeometry(input:
  BoardGeometryInput): BoardGeometry`, `boardGeometryCssVars(geometry:
  BoardGeometry): Record<string, string>`. `BoardGeometryInput = {
  viewportWidth: number; viewportHeight: number; categoryCount: number;
  maxRows: number }`. `BoardGeometry = { panelBeside: boolean; panelWidth:
  number; boardHeight: number; tileHeight: number; headerHeight: number;
  columnWidth: number; boardWidth: number; marginPerSide: number }`.
- Consumes: nothing (pure, no imports from the rest of the app).

- [ ] **Step 1: Write the failing test, table-driven against the acceptance table**

```ts
import { describe, expect, it } from "vitest";
import { computeBoardGeometry } from "../board-geometry";

describe("computeBoardGeometry", () => {
  it("matches the acceptance table: 5 categories x 5 rows @ 1920x1080, panel beside", () => {
    const g = computeBoardGeometry({
      viewportWidth: 1920,
      viewportHeight: 1080,
      categoryCount: 5,
      maxRows: 5,
    });

    expect(g.panelBeside).toBe(true);
    expect(g.columnWidth).toBe(271);
    expect(g.tileHeight).toBe(143);
    expect(g.boardWidth).toBe(1403);
    expect(g.panelWidth).toBe(365);
    expect(g.marginPerSide).toBe(42);
  });

  it("matches the acceptance table: 4 categories x 5 rows @ 2560x1440, panel beside", () => {
    const g = computeBoardGeometry({
      viewportWidth: 2560,
      viewportHeight: 1440,
      categoryCount: 4,
      maxRows: 5,
    });

    expect(g.panelBeside).toBe(true);
    expect(g.columnWidth).toBe(393);
    expect(g.tileHeight).toBe(207);
    expect(g.boardWidth).toBe(1608);
    expect(g.panelWidth).toBe(432);
    expect(g.marginPerSide).toBe(226);
  });

  it("matches the acceptance table: 7 categories x 5 rows @ 1366x768, panel in the bottom row", () => {
    const g = computeBoardGeometry({
      viewportWidth: 1366,
      viewportHeight: 768,
      categoryCount: 7,
      maxRows: 5,
    });

    expect(g.panelBeside).toBe(false);
    expect(g.columnWidth).toBe(165);
    expect(g.tileHeight).toBe(87);
    expect(g.boardWidth).toBe(1227);
    expect(g.marginPerSide).toBe(45);
  });

  it("never lets the board scroll: column width stays within the space available for it", () => {
    const g = computeBoardGeometry({
      viewportWidth: 1920,
      viewportHeight: 1080,
      categoryCount: 5,
      maxRows: 5,
    });

    const rowAvailable = 1920 - 2 * 24;
    const contentWidth = g.panelBeside
      ? g.boardWidth + 20 + g.panelWidth
      : g.boardWidth;

    expect(contentWidth).toBeLessThanOrEqual(rowAvailable);
  });

  it("caps a single wide category by aspect ratio instead of stretching it to fill the row", () => {
    const g = computeBoardGeometry({
      viewportWidth: 3440,
      viewportHeight: 1440,
      categoryCount: 3,
      maxRows: 5,
    });

    // ASPECT=1.9 caps column width at 1.9x the tile height, however much
    // horizontal room three categories leave on an ultrawide screen.
    expect(g.columnWidth).toBeLessThanOrEqual(Math.floor(g.tileHeight * 1.9));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- board-geometry`
Expected: FAIL — `Cannot find module '../board-geometry'` (the file doesn't exist yet).

- [ ] **Step 3: Implement `utils/board-geometry.ts`**

```ts
/**
 * The board's geometry, computed once and shared by every component that
 * renders it — the play board (GameStage/GameBoard) and the editor board
 * (Del 5). Height drives the tile size; width only caps it. See
 * docs/superpowers/specs/2026-09-18-redesign-spillmodus.md, "Del 1", for the
 * derivation of these constants and the acceptance table this is tested
 * against.
 */
export const BOARD_GEOMETRY = {
  /** Top bar: the 48px row plus its 3px progress line. */
  BAR: 51,
  /** Vertical padding on the content row, top and bottom. */
  PAD: 12,
  /** Horizontal padding on the content row, each side. */
  SIDE: 24,
  /** Bottom dock row — always reserved, even when it holds nothing. */
  DOCK: 128,
  /** Gap between tiles, and between the board and the standings panel's row. */
  GAP: 12,
  /** Gap between the board and the standings panel, when the panel is beside it. */
  PANELGAP: 20,
  /** A category header's height as a fraction of one tile's height. */
  HEADF: 0.62,
  /** The widest a tile is allowed to be, as a multiple of its height. */
  ASPECT: 1.9,
  /** The narrowest a column can be and still read from the back of a room. */
  MINCOL: 140,
} as const;

export interface BoardGeometryInput {
  viewportWidth: number;
  viewportHeight: number;
  categoryCount: number;
  maxRows: number;
}

export interface BoardGeometry {
  panelBeside: boolean;
  panelWidth: number;
  boardHeight: number;
  tileHeight: number;
  headerHeight: number;
  columnWidth: number;
  boardWidth: number;
  marginPerSide: number;
}

export function computeBoardGeometry({
  viewportWidth,
  viewportHeight,
  categoryCount,
  maxRows,
}: BoardGeometryInput): BoardGeometry {
  const { BAR, PAD, SIDE, DOCK, GAP, PANELGAP, HEADF, ASPECT, MINCOL } =
    BOARD_GEOMETRY;
  const N = Math.max(1, categoryCount);
  const R = Math.max(1, maxRows);

  const panelWidth = Math.round(clamp(272, 0.19 * viewportWidth, 432));
  const rowAvailable = viewportWidth - 2 * SIDE;
  const panelBeside =
    N * MINCOL + (N - 1) * GAP + panelWidth + PANELGAP <= rowAvailable;

  const avail = rowAvailable - (panelBeside ? panelWidth + PANELGAP : 0);

  const boardHeight = viewportHeight - BAR - 2 * PAD - DOCK;
  const tileHeight = Math.floor((boardHeight - (R + 1) * GAP) / (R + HEADF));
  const headerHeight = Math.round(tileHeight * HEADF);
  const columnWidth = Math.floor(
    Math.min(tileHeight * ASPECT, (avail - (N - 1) * GAP) / N)
  );

  const boardWidth = N * columnWidth + (N - 1) * GAP;
  const contentWidth = panelBeside
    ? boardWidth + PANELGAP + panelWidth
    : boardWidth;
  const marginPerSide = Math.floor((rowAvailable - contentWidth) / 2);

  return {
    panelBeside,
    panelWidth,
    boardHeight,
    tileHeight,
    headerHeight,
    columnWidth,
    boardWidth,
    marginPerSide,
  };
}

/** The CSS custom properties every board-geometry consumer reads via var(). */
export function boardGeometryCssVars(
  geometry: BoardGeometry
): Record<string, string> {
  return {
    "--tile-h": `${geometry.tileHeight}px`,
    "--head-h": `${geometry.headerHeight}px`,
    "--col-w": `${geometry.columnWidth}px`,
    "--panel-w": `${geometry.panelWidth}px`,
  };
}

function clamp(min: number, value: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- board-geometry`
Expected: PASS, all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add utils/board-geometry.ts utils/__tests__/board-geometry.test.ts
git commit -m "feat: add board-geometry pure function and CSS-var helper"
```

---

### Task 2: `hooks/useBoardGeometry.ts` — reactive hook

**Files:**
- Create: `hooks/useBoardGeometry.ts`

**Interfaces:**
- Consumes: `computeBoardGeometry`, `BoardGeometry`,
  `BoardGeometryInput` from `@/utils/board-geometry`.
- Produces: `useBoardGeometry(categoryCount: number, maxRows: number):
  BoardGeometry`, used by `GameStage.tsx` in Task 5.

No unit test here — this is a React hook reading `window`, and this repo has
no component/DOM test infrastructure (`vitest.config.mts` runs
`environment: "node"` and only globs `utils/__tests__` and `lib/__tests__`;
see the file's own comment: "UI behaviour is verified by running the app,
not here"). It's verified in Task 9 against the running app.

- [ ] **Step 1: Implement the hook**

```ts
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { computeBoardGeometry, type BoardGeometry } from "@/utils/board-geometry";

/**
 * Same technique as useMediaQuery: window size is an external store, read
 * with useSyncExternalStore rather than an effect with setState. Two
 * separate primitive stores (not one object) so a resize that doesn't
 * change, say, the height doesn't force a new geometry object on width-only
 * reads elsewhere.
 */
function useViewportWidth(): number {
  return useSyncExternalStore(
    subscribeToResize,
    () => window.innerWidth,
    () => 1280
  );
}

function useViewportHeight(): number {
  return useSyncExternalStore(
    subscribeToResize,
    () => window.innerHeight,
    () => 800
  );
}

function subscribeToResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

export function useBoardGeometry(
  categoryCount: number,
  maxRows: number
): BoardGeometry {
  const viewportWidth = useViewportWidth();
  const viewportHeight = useViewportHeight();

  return useMemo(
    () =>
      computeBoardGeometry({
        viewportWidth,
        viewportHeight,
        categoryCount,
        maxRows,
      }),
    [viewportWidth, viewportHeight, categoryCount, maxRows]
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useBoardGeometry.ts
git commit -m "feat: add useBoardGeometry hook"
```

---

### Task 3: `app/globals.css` — typography reads from the geometry vars

**Files:**
- Modify: `app/globals.css:260-272` (the `.category-header` / `.points-chip`
  rules inside `@layer components`)

**Interfaces:**
- Consumes: `--tile-h`, `--head-h` CSS custom properties, set by Task 5 on
  an ancestor of the board.
- Produces: `.category-header-label`, `.standings-row`,
  `.standings-row-name`, `.standings-row-score` classes, consumed by Task 4
  and Task 6.

- [ ] **Step 1: Replace the two existing rules and add the new ones**

Find (lines 260-272):

```css
  .category-header {
    @apply tile h-24 flex items-center justify-center text-center font-bold uppercase tracking-wider;
    background-image: linear-gradient(
      135deg,
      hsl(var(--primary) / 0.25),
      hsl(var(--accent) / 0.25)
    );
  }
  .points-chip {
    @apply text-3xl md:text-4xl text-accent font-extrabold text-score;
  }
```

Replace with:

```css
  .category-header {
    /* No fixed height: GameBoard's grid track sizes this cell to --head-h,
       and EditableBoard (Del 5) sets its own explicit height. Both rely on
       CSS Grid's default stretch to fill the row. */
    @apply tile flex items-center justify-center text-center font-bold uppercase tracking-wider;
    background-image: linear-gradient(
      135deg,
      hsl(var(--primary) / 0.25),
      hsl(var(--accent) / 0.25)
    );
  }
  .category-header-label {
    /* 0.27 x the header's own height, floored at 13px so a single-row
       board on a short window doesn't shrink the category name past
       reading distance. */
    font-size: max(13px, calc(var(--head-h, 6rem) * 0.27));
  }
  .points-chip {
    @apply text-accent font-extrabold text-score;
    font-size: calc(var(--tile-h, 4rem) * 0.33);
  }

  /* Standings rows: team count decides row height (flex-grow, capped), so
     the height isn't known ahead of time the way a board tile's is. A
     container query reads it back from the box the browser actually laid
     out, instead of a second JS measurement pass. */
  .standings-row {
    container-type: size;
  }
  .standings-row-name {
    font-size: 22cqh;
  }
  .standings-row-score {
    font-size: 42cqh;
  }
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "style: size board and standings typography from geometry vars"
```

---

### Task 4: `components/GameBoard.tsx` — grid reads the geometry vars

**Files:**
- Modify: `components/GameBoard.tsx:76-146`

**Interfaces:**
- Consumes: `--col-w`, `--head-h`, `--tile-h` (set by an ancestor in Task 5),
  `.category-header-label` (Task 3).

- [ ] **Step 1: Replace the grid template and the two vh-clamp overrides**

Find:

```tsx
          className="grid min-h-0 w-full min-w-[36rem] flex-1 justify-center gap-1.5 sm:min-w-0 sm:gap-3"
          style={{
            gridTemplateColumns: `repeat(${categories.length}, minmax(6rem, 18rem))`,
            gridTemplateRows: `auto repeat(${rowCount}, minmax(2.75rem, 1fr))`,
          }}
```

Replace with:

```tsx
          className="grid min-h-0 w-full min-w-[36rem] justify-center gap-1.5 sm:min-w-0 sm:gap-3"
          style={{
            gridTemplateColumns: `repeat(${categories.length}, var(--col-w))`,
            gridTemplateRows: `var(--head-h) repeat(${rowCount}, var(--tile-h))`,
          }}
```

(Dropped `flex-1` on the grid itself — the grid's cells are now sized
exactly by the vars, not stretched to fill a flex parent. `min-w-[36rem]`
stays: it's the small-screen horizontal-scroll fallback, unrelated to this
formula.)

Find:

```tsx
                <span className="line-clamp-3 text-[clamp(0.65rem,2.1vh,1.6rem)] font-bold leading-tight">
```

Replace with:

```tsx
                <span className="line-clamp-3 category-header-label font-bold leading-tight">
```

Find:

```tsx
              <div
                className="category-header !h-auto px-2 py-2"
                style={{ gridColumn: categoryIndex + 1, gridRow: 1 }}
              >
```

Replace with (drop the now-unnecessary `!h-auto` — the grid track is a
fixed `var(--head-h)` and grid items stretch to fill their cell by default):

```tsx
              <div
                className="category-header px-2 py-2"
                style={{ gridColumn: categoryIndex + 1, gridRow: 1 }}
              >
```

Find:

```tsx
                      <span className="points-chip !text-[clamp(1.1rem,3.4vh,2.75rem)]">
```

Replace with:

```tsx
                      <span className="points-chip">
```

- [ ] **Step 2: Commit**

```bash
git add components/GameBoard.tsx
git commit -m "refactor: size GameBoard grid from board-geometry CSS vars"
```

---

### Task 5: `components/GameStage.tsx` — centering, fixed dock, geometry vars

**Files:**
- Modify: `components/GameStage.tsx` (full file — every named export stays,
  the layout body changes throughout)

**Interfaces:**
- Consumes: `useBoardGeometry` (Task 2), `boardGeometryCssVars` (Task 1).
- Produces: sets `--tile-h`/`--head-h`/`--col-w`/`--panel-w` on the content
  row, consumed by Task 4 and Task 6.

- [ ] **Step 1: Replace the whole file**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/GameStage.tsx
git commit -m "refactor: center board+standings via board-geometry, fix the dock height"
```

---

### Task 6: `components/Standings.tsx` — rows fill the column, turn panel added

**Files:**
- Modify: `components/Standings.tsx`

**Interfaces:**
- Consumes: `TurnIndicator` with the new `variant` prop from Task 7.
- Consumes: `.standings-row`, `.standings-row-name`, `.standings-row-score`
  from Task 3.

- [ ] **Step 1: Import `TurnIndicator`**

Find:

```tsx
import { rankTeams } from "@/utils/ranking";
```

Replace with:

```tsx
import { rankTeams } from "@/utils/ranking";
import { TurnIndicator } from "./TurnIndicator";
```

- [ ] **Step 2: Give each row the fill-and-cap sizing and the container-query classes**

Find:

```tsx
      <li
        key={team.id}
        className={isColumn ? "shrink-0" : "min-w-0 shrink-0 basis-52"}
      >
```

Replace with:

```tsx
      <li
        key={team.id}
        className={
          isColumn
            ? "standings-row flex-[1_1_0] min-h-[76px] max-h-[164px]"
            : "standings-row min-w-0 shrink-0 basis-52"
        }
      >
```

- [ ] **Step 3: Switch the row's name/score typography to the container-query classes**

Find:

```tsx
          <span className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-[clamp(0.85rem,2.2vh,1.45rem)]">
            {team.name}
          </span>

          <span className="shrink-0 text-lg font-extrabold text-accent tabular-nums sm:text-[clamp(1.2rem,3.6vh,2.5rem)]">
            {team.score}
          </span>
```

Replace with:

```tsx
          <span className="standings-row-name min-w-0 flex-1 truncate text-sm font-semibold">
            {team.name}
          </span>

          <span className="standings-row-score shrink-0 font-extrabold text-accent tabular-nums">
            {team.score}
          </span>
```

- [ ] **Step 4: Center the column list and add the turn panel underneath**

Find:

```tsx
          <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
            {rows}
          </ol>
        </aside>
```

Replace with:

```tsx
          <ol className="flex min-h-0 flex-1 flex-col justify-center gap-2 overflow-y-auto pr-0.5">
            {rows}
          </ol>

          <TurnIndicator variant="panel" />
        </aside>
```

- [ ] **Step 5: Commit**

```bash
git add components/Standings.tsx
git commit -m "refactor: fill-and-cap standings rows, add the turn panel"
```

---

### Task 7: `components/TurnIndicator.tsx` — add the `panel` variant

**Files:**
- Modify: `components/TurnIndicator.tsx`

**Interfaces:**
- Produces: `TurnIndicator({ variant?: "pill" | "panel" })`. Default
  `"pill"` — every existing call site (the "row" standings layout, Task 8's
  removal from the top bar aside) keeps today's look unless it opts in.
- Consumes: nothing new.

- [ ] **Step 1: Add the prop and the panel branch**

Find:

```tsx
export function TurnIndicator() {
  const teams = useGameStore((state) => state.teams);
```

Replace with:

```tsx
export function TurnIndicator({
  variant = "pill",
}: {
  variant?: "pill" | "panel";
}) {
  const teams = useGameStore((state) => state.teams);
```

Find:

```tsx
  if (!currentTurnTeamId && !isInitialTurnSelection) {
    return (
      <Button
        onClick={initializeTurn}
        size="sm"
        className="shrink-0 bg-gradient-to-r from-accent/90 to-primary/90 font-semibold hover:from-accent hover:to-primary"
      >
        Hvem skal starte?
      </Button>
    );
  }
```

Replace with:

```tsx
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
```

Find:

```tsx
  if (!displayTeam) return null;

  return (
    <>
      {showConfetti && (
        <Confetti
          show={showConfetti}
          onComplete={() => setShowConfetti(false)}
        />
      )}

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
```

Replace with:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/TurnIndicator.tsx
git commit -m "feat: add a panel variant to TurnIndicator for the standings column"
```

---

### Task 8: `components/GameTopBar.tsx` — remove the top-bar turn pill

**Files:**
- Modify: `components/GameTopBar.tsx`

- [ ] **Step 1: Drop the import and the wrapping div**

Find:

```tsx
import { EditModeToggle } from "@/components/editor/EditModeToggle";
import { TurnIndicator } from "@/components/TurnIndicator";
import { countQuestions } from "@/utils/quiz-template";
```

Replace with:

```tsx
import { EditModeToggle } from "@/components/editor/EditModeToggle";
import { countQuestions } from "@/utils/quiz-template";
```

Find:

```tsx
        <div className="hidden min-w-0 shrink items-center sm:flex">
          <TurnIndicator />
        </div>

        <div className="flex shrink-0 items-center gap-1">
```

Replace with:

```tsx
        <div className="flex shrink-0 items-center gap-1">
```

- [ ] **Step 2: Commit**

```bash
git add components/GameTopBar.tsx
git commit -m "refactor: remove the top-bar turn pill, now in the standings panel"
```

---

### Task 9: Verify against the acceptance table in the running app

No automated component tests exist for this (see Task 2's note); this is a
manual/browser verification task, the same way the rest of this codebase's
UI is checked.

**Files:** none — verification only.

- [ ] **Step 1: Start the dev server and open it in the browser tool**

Run `preview_start` for this project's dev server (check
`.claude/launch.json`; create an entry running `npm run dev` on the
project's port if one doesn't exist yet). Load a quiz with 5 categories x 5
questions (or seed one) and enter play mode.

- [ ] **Step 2: Measure each of the three acceptance rows**

For each of the three viewport sizes in the acceptance table
(1920×1080, 2560×1440, 1366×768 — set with `resize_window`, custom width and
height), with a board matching that row's category/row count:

Use `javascript_tool` to read `getComputedStyle`/`getBoundingClientRect` for
a tile (`.tile.points-chip`'s closest tile ancestor), the grid wrapper, and
the standings panel, and confirm column width, tile height, board width,
panel width (or "i bunnraden" — panel not rendered beside), and the left
margin before the board all match the table's values (allow ±1px for
sub-pixel rounding across floor/round boundaries). Confirm no scrollbar
appears on the page at any of the three sizes.

- [ ] **Step 3: Confirm the board height doesn't change when a round starts or ends**

Read the board's `getBoundingClientRect().height` before opening a question,
after opening it (dock has the floor), and after ending the round. All
three reads must be equal.

- [ ] **Step 4: Confirm symmetric margins on an ultra-wide board**

Resize to a very wide viewport (e.g. 3440×1440) with 3 categories. Confirm
the left and right margins around the centered board+panel group are equal
(this is the expected large-but-symmetric-margin case called out in the
spec, not a bug).

- [ ] **Step 5: Run the full test suite and build**

```bash
npm test
npm run build
```

Expected: all tests pass, build succeeds with no new type errors.

- [ ] **Step 6: Commit if Step 1-4 required any fixes**

```bash
git add -A
git commit -m "fix: board-geometry verification fixes"
```

(Skip this commit if no fixes were needed.)

---

## Self-Review Notes

- **Spec coverage:** the regnestykke (Task 1), CSS-var export (Task 1),
  container-query note (Task 3/6), typography table (Task 3/4/6), row
  fill-and-center + turn field (Task 6/7), file list (all touched: GameStage,
  GameBoard, Standings, GameTopBar, useMediaQuery — see below —, globals.css,
  board-geometry.ts), and the acceptance table (Task 9) are all covered.
- **`useMediaQuery.ts`:** the spec's file list names this file for "the
  threshold", but the threshold logic (`COMFORTABLE_COLUMN`/
  `PANEL_AND_GUTTERS`) actually lived inline in `GameStage.tsx`, not in
  `useMediaQuery.ts` (confirmed by reading both files). `useBoardGeometry`
  replaces that inline threshold entirely with the real formula's
  `panelBeside` output, computed off actual viewport width via
  `useSyncExternalStore` — the same non-effect technique `useMediaQuery`
  uses (fallgruve 6), just without a `matchMedia` string threshold in
  between. `useMediaQuery.ts` itself is unmodified since nothing in this
  part still calls it. `useIsWideScreen` (also exported there) is unrelated
  (editor inspector panel, Del 5) and untouched.
  - **`bottomRowHasContent`/bottom-row height:** removed from GameStage; the
  dock row is unconditionally 128px now (`h-32`).
- **Type consistency:** `BoardGeometry`'s field names
  (`panelBeside`, `panelWidth`, `tileHeight`, `headerHeight`, `columnWidth`,
  `boardWidth`, `marginPerSide`) are used identically in Task 1's test, the
  hook (Task 2), and `GameStage.tsx` (Task 5) — checked, no drift.
