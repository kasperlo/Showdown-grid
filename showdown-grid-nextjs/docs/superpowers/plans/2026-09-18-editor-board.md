# Editor Board (Del 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editor board use the same one-grid, no-wrap geometry as
the play board, fix the ten specific defects the spec lists (status text,
floating inspector, an editable points field, dead move actions, unconfirmed
deletes, a focus-stealing field, a cramped "new category" button, an
unconfirmed board replace, and a readiness chip that ignores title/teams).

**Architecture:** `utils/board-geometry.ts`'s `computeBoardGeometry` gets
two new *optional* inputs — `panelWidth` (override the play board's own
clamp) and `boardHeightOverride` (skip the play board's
`BAR`/`PAD`/`DOCK` subtraction) — so the editor can reuse the exact same
row/column math with its own panel-width and chrome-height policy, without
changing a single output for any call that omits them (Del 1's board is
untouched). `EditableBoard.tsx` moves from `repeat(auto-fit, minmax(...))`
plus per-column flex stacks to one CSS grid, the same shape as
`GameBoard.tsx` from Del 1: one column per category, a shared header row, a
shared trailing "add a card" row, and a full-height "new category" column.

**Tech Stack:** Next.js (App Router), React, Zustand, Tailwind CSS, vitest
(node environment).

**Spec:** [docs/superpowers/specs/2026-09-18-redesign-spillmodus.md](../specs/2026-09-18-redesign-spillmodus.md)
— "Del 5 — Redigeringsbrettet".

**Depends on:** [2026-09-18-board-geometry.md](2026-09-18-board-geometry.md)
(Del 1) — this plan extends the `utils/board-geometry.ts` and
`hooks/useBoardGeometry.ts` files that plan creates. Del 1 must land first.

## Global Constraints

- One column per category, points ladder downward, no wrapping — same
  single-grid approach as `GameBoard.tsx` (fallgruve 5: one grid for every
  column, not per-column flex stacks, or an N-question category stretches
  taller than its neighbor's).
- Every new confirmation dialog follows the existing controlled
  `AlertDialog` pattern already in this codebase (`EditableBoard.tsx`'s
  category-delete dialog: `open`/`onOpenChange` off a piece of state,
  destructive-styled `AlertDialogAction`, "Kan ikke angres." as the warning)
  — not the uncontrolled `AlertDialogTrigger` variant.

## Assumptions (call out, not silent)

1. **The exact "248×157" pixel example (5 categories, 1920px wide,
   inspector 460px) has no stated row count**, unlike Del 1's acceptance
   table, which specified rows for every example. Without it the number
   can't be solved for exactly. Task 1 adds a documented, tunable
   `EDITOR_CHROME` constant (estimated from the editor page's actual
   chrome: `EditorBar` + title + outer padding + `BoardLegend`) standing in
   for Del 1's `BAR + 2*PAD + DOCK`; Task 9 checks the real number in the
   browser and adjusts the constant if it's off, rather than asserting a
   match this plan can't independently verify.
2. **`moveCard` is removed, `moveQuestion` is wired up.** Both exist in
   `types.ts`/`store.ts` today and neither is called from any component
   (verified by a repo-wide grep). The spec allows either "koble dem opp,
   eller fjern dem" for both — `moveQuestion` (reorder within a column) has
   an obvious, low-risk UI (two buttons in the inspector); `moveCard`
   (moving a card to a different category/position) would need a
   category/position picker that's out of scope for this pass, so it's
   deleted as genuinely dead code rather than left unreachable.
3. **Moving a card also moves the inspector's selection to follow it.**
   `moveQuestion` swaps two array positions but doesn't know which one the
   inspector was looking at; without also calling `selectCard` at the new
   index, "Flytt opp" would leave the panel showing the *other*,
   now-swapped card instead of the one just moved. The inspector's click
   handlers do both.
4. **`autoFocus` is removed only from the question field** (spec's literal
   wording: "spørsmålsfeltet"), not from the joker task field, even though
   the same focus-stealing bug is structurally identical there. Left alone
   since the spec doesn't ask for it and joker cards are the rarer case in
   a queue review.
5. **The readiness chip's title/team check is local to `EditorBar.tsx`**,
   not folded into `utils/card-status.ts`'s shared `readiness()` — that
   function is also used by `QuestionInspector` and `BoardLegend`, which
   only care about per-card completeness, not the quiz's title or team
   list. Extending its return shape would ripple into two call sites that
   don't need the change.
6. **`app/api/quiz-runs/active/route.ts` note from Del 3 doesn't apply
   here** — Del 5 has no session/API surface at all; this note only exists
   to confirm nothing in this part touches that file.

---

### Task 1: `utils/board-geometry.ts` — `panelWidth` and `boardHeightOverride`

**Files:**
- Modify: `utils/board-geometry.ts`
- Modify: `utils/__tests__/board-geometry.test.ts`

**Interfaces:**
- Produces: `BoardGeometryInput` gains two optional fields, `panelWidth?:
  number` and `boardHeightOverride?: number`. `clamp` becomes an exported
  function (was private to the module). Output shape (`BoardGeometry`) is
  unchanged.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing tests, alongside Del 1's existing ones**

Add to the end of the existing `describe("computeBoardGeometry", ...)`
block in `utils/__tests__/board-geometry.test.ts` (do not remove any
existing `it(...)` — this only adds cases):

```ts
  it("uses an explicit panelWidth instead of computing one, and treats the panel as always beside the board", () => {
    const g = computeBoardGeometry({
      viewportWidth: 1920,
      viewportHeight: 1080,
      categoryCount: 5,
      maxRows: 5,
      panelWidth: 460,
    });

    expect(g.panelWidth).toBe(460);
    expect(g.panelBeside).toBe(true);
  });

  it("uses boardHeightOverride instead of BAR/PAD/DOCK when given", () => {
    const withOverride = computeBoardGeometry({
      viewportWidth: 1920,
      viewportHeight: 1080,
      categoryCount: 5,
      maxRows: 5,
      boardHeightOverride: 700,
    });
    const withoutOverride = computeBoardGeometry({
      viewportWidth: 1920,
      viewportHeight: 1080,
      categoryCount: 5,
      maxRows: 5,
    });

    expect(withOverride.boardHeight).toBe(700);
    expect(withOverride.tileHeight).not.toBe(withoutOverride.tileHeight);
  });

  it("panelWidth and boardHeightOverride are both optional and don't change Del 1's numbers when omitted", () => {
    const g = computeBoardGeometry({
      viewportWidth: 1920,
      viewportHeight: 1080,
      categoryCount: 5,
      maxRows: 5,
    });

    expect(g.panelWidth).toBe(365);
    expect(g.columnWidth).toBe(271);
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npm test -- board-geometry`
Expected: the three new cases FAIL (`panelWidth`/`boardHeightOverride` not
accepted by the current signature — either a type error or the option is
silently ignored, producing the old default output).

- [ ] **Step 3: Extend the implementation**

Find:

```ts
export interface BoardGeometryInput {
  viewportWidth: number;
  viewportHeight: number;
  categoryCount: number;
  maxRows: number;
}
```

Replace with:

```ts
export interface BoardGeometryInput {
  viewportWidth: number;
  viewportHeight: number;
  categoryCount: number;
  maxRows: number;
  /** Overrides the computed panel width and always treats the panel as
   * beside the board (skips the MINCOL/panelBeside fit check) — for a
   * context, like the editor, whose panel visibility is decided elsewhere
   * (a fixed breakpoint), not by available width. */
  panelWidth?: number;
  /** Skips the BAR/PAD/DOCK subtraction and uses this as boardHeight
   * directly — for a context whose chrome isn't the play board's fixed top
   * bar and bottom dock. */
  boardHeightOverride?: number;
}
```

Find:

```ts
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
```

Replace with:

```ts
export function computeBoardGeometry({
  viewportWidth,
  viewportHeight,
  categoryCount,
  maxRows,
  panelWidth: panelWidthOverride,
  boardHeightOverride,
}: BoardGeometryInput): BoardGeometry {
  const { BAR, PAD, SIDE, DOCK, GAP, PANELGAP, HEADF, ASPECT, MINCOL } =
    BOARD_GEOMETRY;
  const N = Math.max(1, categoryCount);
  const R = Math.max(1, maxRows);

  const panelWidth =
    panelWidthOverride ?? Math.round(clamp(272, 0.19 * viewportWidth, 432));
  const rowAvailable = viewportWidth - 2 * SIDE;
  const panelBeside =
    panelWidthOverride !== undefined ||
    N * MINCOL + (N - 1) * GAP + panelWidth + PANELGAP <= rowAvailable;

  const avail = rowAvailable - (panelBeside ? panelWidth + PANELGAP : 0);

  const boardHeight = boardHeightOverride ?? viewportHeight - BAR - 2 * PAD - DOCK;
  const tileHeight = Math.floor((boardHeight - (R + 1) * GAP) / (R + HEADF));
```

Find:

```ts
function clamp(min: number, value: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```

Replace with:

```ts
export function clamp(min: number, value: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```

- [ ] **Step 4: Run the tests to verify they all pass**

Run: `npm test -- board-geometry`
Expected: PASS — every Del 1 case unchanged, plus the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add utils/board-geometry.ts utils/__tests__/board-geometry.test.ts
git commit -m "feat: board-geometry accepts an explicit panelWidth and boardHeightOverride"
```

---

### Task 2: `hooks/useBoardGeometry.ts` — pass the editor's overrides through

**Files:**
- Modify: `hooks/useBoardGeometry.ts`

**Interfaces:**
- Produces: `useBoardGeometry(categoryCount, maxRows, options?: {
  panelWidthClamp?: [min: number, vwFraction: number, max: number];
  boardHeightOverride?: number }): BoardGeometry`. Existing 2-argument call
  sites (Del 1's `GameStage.tsx`) are unaffected — `options` is optional.

No unit test — same reasoning as Del 1's Task 2 (a React hook reading
`window`, no DOM test infra in this repo). Verified in Task 9.

- [ ] **Step 1: Extend the hook**

Find:

```ts
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { computeBoardGeometry, type BoardGeometry } from "@/utils/board-geometry";
```

Replace with:

```ts
import { useMemo, useSyncExternalStore } from "react";
import {
  clamp,
  computeBoardGeometry,
  type BoardGeometry,
} from "@/utils/board-geometry";
```

Find:

```ts
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

Replace with:

```ts
export interface UseBoardGeometryOptions {
  /** [min, fractionOfViewportWidth, max] — the editor's floating panel,
   * clamp(360px, 24vw, 460px), is passed as [360, 0.24, 460]. */
  panelWidthClamp?: [number, number, number];
  boardHeightOverride?: number;
}

export function useBoardGeometry(
  categoryCount: number,
  maxRows: number,
  options?: UseBoardGeometryOptions
): BoardGeometry {
  const viewportWidth = useViewportWidth();
  const viewportHeight = useViewportHeight();
  const panelWidthClamp = options?.panelWidthClamp;
  const boardHeightOverride = options?.boardHeightOverride;

  return useMemo(() => {
    const panelWidth = panelWidthClamp
      ? Math.round(
          clamp(
            panelWidthClamp[0],
            panelWidthClamp[1] * viewportWidth,
            panelWidthClamp[2]
          )
        )
      : undefined;

    return computeBoardGeometry({
      viewportWidth,
      viewportHeight,
      categoryCount,
      maxRows,
      panelWidth,
      boardHeightOverride,
    });
  }, [
    viewportWidth,
    viewportHeight,
    categoryCount,
    maxRows,
    panelWidthClamp,
    boardHeightOverride,
  ]);
}
```

(`useCallback` was only used by the removed inline helpers — check it has
no other use in this file before dropping the import; per Del 1's Task 2 it
doesn't.)

- [ ] **Step 2: Commit**

```bash
git add hooks/useBoardGeometry.ts
git commit -m "feat: useBoardGeometry accepts a panel-width clamp and a board-height override"
```

---

### Task 3: `components/editor/EditableBoard.tsx` — one grid, redesigned cards, full-height "new category"

**Files:**
- Modify: `components/editor/EditableBoard.tsx` (full file)

**Interfaces:**
- Consumes: `useBoardGeometry` (Task 2), `boardGeometryCssVars` (Del 1's
  `utils/board-geometry.ts`).

`EDITOR_CHROME` (see Assumption 1) stands in for the play board's
`BAR + 2*PAD + DOCK` — the editor's own `EditorBar` + title + outer page
padding + `BoardLegend`, estimated at 240px. Task 9 tunes it against the
spec's 248×157 example.

- [ ] **Step 1: Replace the whole file**

```tsx
"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useGameStore } from "@/utils/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import {
  ArrowLeft,
  ArrowRight,
  Code2,
  Copy,
  Image as ImageIcon,
  ListChecks,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react";
import {
  cardStatus,
  sameCard,
  statusLabel,
  type CardRef,
} from "@/utils/card-status";
import { useBoardGeometry } from "@/hooks/useBoardGeometry";
import { boardGeometryCssVars } from "@/utils/board-geometry";

/** EditorBar + title + BoardLegend + outer page padding — see Assumption 1. */
const EDITOR_CHROME = 240;

/**
 * The board, editable in place. Same one-grid layout the room sees — one
 * column per category, points ladder downward, no wrapping — so switching
 * to Spill really is the preview, not a different shape.
 */
export function EditableBoard() {
  const categories = useGameStore((s) => s.categories);
  const selectedCard = useGameStore((s) => s.selectedCard);
  const queue = useGameStore((s) => s.queue);
  const selectCard = useGameStore((s) => s.selectCard);
  const startQueue = useGameStore((s) => s.startQueue);
  const addCategory = useGameStore((s) => s.addCategory);
  const removeCategory = useGameStore((s) => s.removeCategory);
  const renameCategory = useGameStore((s) => s.renameCategory);
  const duplicateCategory = useGameStore((s) => s.duplicateCategory);
  const moveCategory = useGameStore((s) => s.moveCategory);
  const addQuestionToCategory = useGameStore((s) => s.addQuestionToCategory);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);

  const maxRows = categories.reduce(
    (most, c) => Math.max(most, c.questions.length),
    0
  );
  const geometry = useBoardGeometry(categories.length || 1, maxRows || 1, {
    panelWidthClamp: [360, 0.24, 460],
    boardHeightOverride:
      (typeof window !== "undefined" ? window.innerHeight : 900) -
      EDITOR_CHROME,
  });
  const geometryVars = boardGeometryCssVars(geometry) as CSSProperties;

  const queuePosition = (ref: CardRef): number | null => {
    if (!queue?.active) return null;
    const index = queue.ids.findIndex((id) => sameCard(id, ref));
    return index === -1 ? null : index;
  };

  return (
    <div className="space-y-4">
      <div
        className="-mx-4 grid gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        style={{
          ...geometryVars,
          gridTemplateColumns: `repeat(${categories.length}, var(--col-w)) minmax(180px, var(--col-w))`,
          gridTemplateRows: `var(--head-h) repeat(${Math.max(maxRows, 1)}, var(--tile-h)) auto`,
        }}
      >
        {categories.map((category, categoryIndex) => {
          const done = category.questions.filter(
            (q) => cardStatus(q) === "complete"
          ).length;

          return (
            <div
              key={categoryIndex}
              className="contents"
            >
              <div
                className="category-header flex-col gap-1 px-2"
                style={{ gridColumn: categoryIndex + 1, gridRow: 1 }}
              >
                <div className="flex w-full items-center gap-1">
                  <Input
                    value={category.name}
                    onChange={(e) =>
                      renameCategory(categoryIndex, e.target.value)
                    }
                    aria-label={`Kategori ${categoryIndex + 1}`}
                    className="h-7 border-0 border-b border-dashed border-foreground/40 bg-transparent px-1 text-center text-sm font-bold uppercase tracking-[0.08em] shadow-none focus-visible:ring-0"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        title={`Handlinger for ${category.name}`}
                        aria-label={`Handlinger for ${category.name}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => startQueue("category", categoryIndex)}
                      >
                        <ListChecks className="mr-2 h-4 w-4" />
                        Gå gjennom kolonnen
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => addQuestionToCategory(categoryIndex)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Legg til kort
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => duplicateCategory(categoryIndex)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Dupliser
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={categoryIndex === 0}
                        onClick={() => moveCategory(categoryIndex, -1)}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Flytt venstre
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={categoryIndex === categories.length - 1}
                        onClick={() => moveCategory(categoryIndex, 1)}
                      >
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Flytt høyre
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setCategoryToDelete(categoryIndex)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Slett
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <span
                  className="text-[0.65rem] font-normal normal-case tracking-normal text-muted-foreground"
                  title={`${done} av ${category.questions.length} kort er ferdige`}
                >
                  {done}/{category.questions.length}
                </span>
              </div>

              {category.questions.map((question, questionIndex) => {
                const ref = { categoryIndex, questionIndex };
                const status = cardStatus(question);
                const isSelected = sameCard(selectedCard, ref);
                const position = queuePosition(ref);
                const isCurrentInQueue =
                  position !== null && position === queue?.position;
                const label = statusLabel(status);
                const preview = question.isJoker
                  ? question.jokerTask?.trim()
                  : question.question.trim() ||
                    // Newlines flattened: the tile clamps to a few lines, and a
                    // snippet's own line breaks would spend them both.
                    question.code?.trim().replace(/\s*\n\s*/g, " ⏎ ");

                return (
                  <div
                    key={questionIndex}
                    className="relative min-h-0"
                    style={{
                      gridColumn: categoryIndex + 1,
                      gridRow: questionIndex + 2,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => selectCard(ref)}
                      aria-current={isSelected ? "true" : undefined}
                      className={[
                        "tile flex h-full w-full flex-col items-start gap-1.5 px-3 py-2.5 text-left transition-colors hover:!translate-y-0 hover:!scale-100",
                        isSelected
                          ? "turn-highlight border-2 border-accent bg-accent/10"
                          : status === "complete"
                          ? "hover:border-accent/70"
                          : "border border-dashed border-destructive/60 bg-destructive/[0.07] hover:border-destructive",
                      ].join(" ")}
                    >
                      <span className="flex w-full items-center gap-1.5">
                        <span className="text-[26px] font-extrabold leading-none tabular-nums text-accent">
                          {question.points}
                        </span>
                        {question.isJoker && (
                          <span className="rounded-full bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 px-1.5 py-px text-[0.6rem] font-extrabold tracking-wider text-white">
                            JOKER
                          </span>
                        )}
                        {question.code?.trim() && (
                          <Code2
                            className="h-3.5 w-3.5 text-muted-foreground"
                            aria-label="Har kode"
                          />
                        )}
                        {question.imageUrl?.trim() && (
                          <ImageIcon
                            className="h-3.5 w-3.5 text-muted-foreground"
                            aria-label="Har bilde"
                          />
                        )}
                        <span
                          className={`ml-auto h-2 w-2 shrink-0 rounded-full ${
                            status === "complete" ? "bg-success" : "bg-destructive"
                          }`}
                        />
                      </span>

                      {label && (
                        <span className="text-[11px] font-bold uppercase tracking-wide text-destructive">
                          {label}
                        </span>
                      )}

                      <span
                        className={`line-clamp-3 flex-1 text-xs leading-snug ${
                          question.code?.trim() && !question.question.trim()
                            ? "font-mono text-muted-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {preview || "—"}
                      </span>
                    </button>

                    {/* Only the card you are on is numbered. Badging all of
                        them turned a 29-card review into 29 labels competing
                        with the questions. */}
                    {isCurrentInQueue && (
                      <span className="pointer-events-none absolute -top-2 left-2 rounded-full bg-accent px-2 py-px text-[0.65rem] font-extrabold text-accent-foreground">
                        {(position ?? 0) + 1} av {queue?.ids.length}
                      </span>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => addQuestionToCategory(categoryIndex)}
                style={{
                  gridColumn: categoryIndex + 1,
                  gridRow: Math.max(maxRows, 1) + 2,
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-muted-foreground/40 py-2 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                title="Legg til et kort nederst i kolonnen"
              >
                <Plus className="h-4 w-4" />
                Kort
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addCategory}
          style={{ gridColumn: categories.length + 1, gridRow: "1 / -1" }}
          className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/40 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          title="Legg til en ny kategori på brettet"
        >
          <Plus className="h-5 w-5" />
          Ny kategori
        </button>
      </div>

      <AlertDialog
        open={categoryToDelete !== null}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Slette «
              {categoryToDelete !== null
                ? categories[categoryToDelete]?.name
                : ""}
              »?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Kategorien og alle kortene i den forsvinner. Kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (categoryToDelete !== null) {
                  removeCategory(categoryToDelete);
                  useGameStore.getState().selectCard(null);
                }
                setCategoryToDelete(null);
              }}
            >
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

(The `className="contents"` wrapper per category keeps its header/cards/add-
button as direct grid children for placement purposes, while still letting
`.map()` return one grouped element per category — `display: contents`
makes the wrapper itself invisible to grid layout.)

- [ ] **Step 2: Commit**

```bash
git add components/editor/EditableBoard.tsx
git commit -m "refactor: EditableBoard uses one grid, matching the play board's geometry"
```

---

### Task 4: `components/editor/QuestionInspector.tsx` — points field, move buttons, delete confirmation, drop autoFocus

**Files:**
- Modify: `components/editor/QuestionInspector.tsx`

- [ ] **Step 1: Import what's needed**

Find:

```tsx
import { ImageUpload } from "@/components/ImageUpload";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Code2,
  Lightbulb,
  ImagePlus,
  ListChecks,
  Trash2,
  X,
} from "lucide-react";
import {
  cardAt,
  cardStatus,
  readiness,
  sameCard,
  statusLabel,
} from "@/utils/card-status";
```

Replace with:

```tsx
import { ImageUpload } from "@/components/ImageUpload";
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
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Code2,
  Lightbulb,
  ImagePlus,
  ListChecks,
  Trash2,
  X,
} from "lucide-react";
import {
  cardAt,
  cardStatus,
  readiness,
  sameCard,
  statusLabel,
} from "@/utils/card-status";
```

- [ ] **Step 2: Read `moveQuestion`, add local state, remove `autoFocus` from the question field**

Find:

```tsx
  const updateQuestion = useGameStore((s) => s.updateQuestion);
  const removeQuestionFromCategory = useGameStore(
    (s) => s.removeQuestionFromCategory
  );

  const question = cardAt(categories, selectedCard);
  const counts = readiness(categories);
  const [imageOpen, setImageOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);
```

Replace with:

```tsx
  const updateQuestion = useGameStore((s) => s.updateQuestion);
  const removeQuestionFromCategory = useGameStore(
    (s) => s.removeQuestionFromCategory
  );
  const moveQuestion = useGameStore((s) => s.moveQuestion);

  const question = cardAt(categories, selectedCard);
  const counts = readiness(categories);
  const [imageOpen, setImageOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
```

Find:

```tsx
            <Field label="Spørsmål">
              <Textarea
                value={question.question}
                onChange={(e) => patch({ question: e.target.value })}
                rows={3}
                autoFocus
                className="text-base font-semibold leading-snug"
              />
            </Field>
```

Replace with:

```tsx
            <Field label="Spørsmål">
              <Textarea
                value={question.question}
                onChange={(e) => patch({ question: e.target.value })}
                rows={3}
                className="text-base font-semibold leading-snug"
              />
            </Field>
```

- [ ] **Step 3: Add the points field, right after the header row**

Find:

```tsx
        {warning && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/[0.12] px-3 py-2 text-sm text-destructive">
            <CircleAlert className="h-4 w-4 shrink-0" />
            {warning}
          </p>
        )}

        {question.isJoker ? (
```

Replace with:

```tsx
        {warning && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/[0.12] px-3 py-2 text-sm text-destructive">
            <CircleAlert className="h-4 w-4 shrink-0" />
            {warning}
          </p>
        )}

        <Field label="Poeng">
          <Input
            type="number"
            min={0}
            step={50}
            value={question.points}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              patch({ points: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 });
            }}
            className="w-28"
            aria-label="Poeng"
          />
        </Field>

        {question.isJoker ? (
```

- [ ] **Step 4: Move buttons and a confirmed delete, replacing the direct-delete button**

Find:

```tsx
        {(category?.questions.length ?? 0) > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              removeQuestionFromCategory(
                selectedCard.categoryIndex,
                selectedCard.questionIndex
              );
              selectCard(null);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Slett kortet
          </Button>
        )}
      </div>
```

Replace with:

```tsx
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={selectedCard.questionIndex === 0}
            onClick={() => {
              const newIndex = selectedCard.questionIndex - 1;
              moveQuestion(
                selectedCard.categoryIndex,
                selectedCard.questionIndex,
                -1
              );
              selectCard({
                categoryIndex: selectedCard.categoryIndex,
                questionIndex: newIndex,
              });
            }}
          >
            <ArrowUp className="h-4 w-4" />
            Flytt opp
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={
              selectedCard.questionIndex >=
              (category?.questions.length ?? 1) - 1
            }
            onClick={() => {
              const newIndex = selectedCard.questionIndex + 1;
              moveQuestion(
                selectedCard.categoryIndex,
                selectedCard.questionIndex,
                1
              );
              selectCard({
                categoryIndex: selectedCard.categoryIndex,
                questionIndex: newIndex,
              });
            }}
          >
            <ArrowDown className="h-4 w-4" />
            Flytt ned
          </Button>
        </div>

        {(category?.questions.length ?? 0) > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Slett kortet
          </Button>
        )}

        <AlertDialog
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Slette dette kortet?</AlertDialogTitle>
              <AlertDialogDescription>
                {question.points} poeng i «{category?.name}» forsvinner. Kan
                ikke angres.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  removeQuestionFromCategory(
                    selectedCard.categoryIndex,
                    selectedCard.questionIndex
                  );
                  selectCard(null);
                  setConfirmingDelete(false);
                }}
              >
                Slett
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
```

- [ ] **Step 5: Commit**

```bash
git add components/editor/QuestionInspector.tsx
git commit -m "feat: editable points field, move up/down, confirmed card delete, drop autoFocus"
```

---

### Task 5: `components/editor/EditorBar.tsx` — readiness includes title and teams

**Files:**
- Modify: `components/editor/EditorBar.tsx`

- [ ] **Step 1: Add the two extra checks and use them for the chip**

Find:

```tsx
export function EditorBar() {
  const editMode = useGameStore((s) => s.editMode);
  const categories = useGameStore((s) => s.categories);
  const startQueue = useGameStore((s) => s.startQueue);
  const canEdit = useGameStore((s) => s.canEditActiveQuiz());
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  if (!canEdit) return null;

  const { missing } = readiness(categories);
```

Replace with:

```tsx
export function EditorBar() {
  const editMode = useGameStore((s) => s.editMode);
  const categories = useGameStore((s) => s.categories);
  const quizTitle = useGameStore((s) => s.quizTitle);
  const teams = useGameStore((s) => s.teams);
  const startQueue = useGameStore((s) => s.startQueue);
  const canEdit = useGameStore((s) => s.canEditActiveQuiz());
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  if (!canEdit) return null;

  const { missing } = readiness(categories);
  const missingParts: string[] = [];
  if (missing > 0) missingParts.push(`${missing} kort`);
  if (!quizTitle.trim()) missingParts.push("tittel");
  if (teams.length === 0) missingParts.push("lag");
```

- [ ] **Step 2: Use `missingParts` for the chip instead of `missing` alone**

Find:

```tsx
        {editMode &&
          (missing > 0 ? (
            <Button
              size="sm"
              className="h-8 gap-1.5 rounded-full bg-accent text-xs font-bold text-accent-foreground hover:bg-accent/90"
              onClick={() => startQueue("incomplete")}
              title="Gå gjennom kortene som mangler noe"
            >
              <ListChecks className="h-3.5 w-3.5" />
              {missing} {missing === 1 ? "mangel" : "mangler"}
            </Button>
          ) : (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-success/50 bg-success/[0.14] px-3 text-xs font-bold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Klar
            </span>
          ))}
```

Replace with:

```tsx
        {editMode &&
          (missingParts.length > 0 ? (
            <Button
              size="sm"
              className="h-8 gap-1.5 rounded-full bg-accent text-xs font-bold text-accent-foreground hover:bg-accent/90"
              onClick={() => missing > 0 && startQueue("incomplete")}
              title={`Mangler: ${missingParts.join(", ")}`}
            >
              <ListChecks className="h-3.5 w-3.5" />
              {missingParts.join(", ")} mangler
            </Button>
          ) : (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-success/50 bg-success/[0.14] px-3 text-xs font-bold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Klar
            </span>
          ))}
```

- [ ] **Step 3: Commit**

```bash
git add components/editor/EditorBar.tsx
git commit -m "feat: the readiness chip accounts for a missing title or teams"
```

---

### Task 6: `components/editor/BoardTransfer.tsx` — confirm before replacing the board

**Files:**
- Modify: `components/editor/BoardTransfer.tsx`

- [ ] **Step 1: Import `AlertDialog`, add the two pieces of confirm state**

Find:

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, FileUp, ClipboardPaste } from "lucide-react";
```

Replace with:

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Download, FileUp, ClipboardPaste } from "lucide-react";
```

Find:

```tsx
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [replaceMode, setReplaceMode] = useState<"replace" | "append">("replace");
  const fileInputRef = useRef<HTMLInputElement>(null);
```

Replace with:

```tsx
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [replaceMode, setReplaceMode] = useState<"replace" | "append">("replace");
  const [confirmPasteOpen, setConfirmPasteOpen] = useState(false);
  const [confirmFile, setConfirmFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 2: Gate `handleFile`'s trigger and `handlePaste`'s trigger behind a confirmation when there's something to lose**

Find:

```tsx
  const handlePaste = () => {
```

Insert immediately before it:

```tsx
  const requestFile = (file: File) => {
    if (categories.length > 0) {
      setConfirmFile(file);
      return;
    }
    void handleFile(file);
  };

  const requestPaste = () => {
    if (replaceMode === "replace" && categories.length > 0) {
      setConfirmPasteOpen(true);
      return;
    }
    handlePaste();
  };

  const handlePaste = () => {
```

Find:

```tsx
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
```

Replace with:

```tsx
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) requestFile(file);
          }}
        />
```

Find:

```tsx
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasteOpen(false)}>
                Avbryt
              </Button>
              <Button onClick={handlePaste} disabled={!pasteText.trim()}>
                Les inn
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
```

Replace with:

```tsx
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasteOpen(false)}>
                Avbryt
              </Button>
              <Button onClick={requestPaste} disabled={!pasteText.trim()}>
                Les inn
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
```

- [ ] **Step 3: Add the two confirmation dialogs, right before the closing `</div>` of the component**

Find:

```tsx
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleExport}
          disabled={!categories.length}
        >
          <Download className="h-4 w-4" />
          Eksporter JSON
        </Button>
      </div>
    </div>
  );
}
```

Replace with:

```tsx
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleExport}
          disabled={!categories.length}
        >
          <Download className="h-4 w-4" />
          Eksporter JSON
        </Button>
      </div>

      <AlertDialog open={confirmPasteOpen} onOpenChange={setConfirmPasteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erstatte hele brettet?</AlertDialogTitle>
            <AlertDialogDescription>
              {categories.length}{" "}
              {categories.length === 1 ? "eksisterende kategori" : "eksisterende kategorier"}{" "}
              forsvinner og erstattes av det du limte inn. Kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmPasteOpen(false);
                handlePaste();
              }}
            >
              Erstatt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!confirmFile}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erstatte hele brettet?</AlertDialogTitle>
            <AlertDialogDescription>
              {categories.length}{" "}
              {categories.length === 1 ? "eksisterende kategori" : "eksisterende kategorier"}{" "}
              forsvinner og erstattes av innholdet i «{confirmFile?.name}».
              Kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const file = confirmFile;
                setConfirmFile(null);
                if (file) void handleFile(file);
              }}
            >
              Erstatt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/editor/BoardTransfer.tsx
git commit -m "feat: confirm before a paste or file import replaces the board"
```

---

### Task 7: `app/page.tsx` — floating inspector width

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the fixed 404px column**

Find:

```tsx
        <div
          className={
            isWide
              ? "grid min-h-screen grid-cols-[minmax(0,1fr)_404px]"
              : undefined
          }
        >
```

Replace with:

```tsx
        <div
          className={
            isWide
              ? "grid min-h-screen grid-cols-[minmax(0,1fr)_clamp(360px,24vw,460px)]"
              : undefined
          }
        >
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "style: the editor's inspector column floats between 360 and 460px"
```

---

### Task 8: Remove the unused `moveCard`

**Files:**
- Modify: `utils/types.ts`
- Modify: `utils/store.ts`

See Assumption 2 — confirmed by a repo-wide grep that no component calls
`moveCard` (only `moveQuestion`, wired up in Task 4).

- [ ] **Step 1: `utils/types.ts`**

Find:

```ts
  /** Moves a card to another position, re-applying the points ladder. */
  moveCard: (from: CardRef, to: CardRef) => void;
```

Delete these two lines entirely.

- [ ] **Step 2: `utils/store.ts`**

Find:

```ts
    /**
     * Moves a card. The points ladder is re-applied afterwards, so the card
     * takes on the points of wherever it lands — see normalizePoints.
     */
    moveCard: (from: CardRef, to: CardRef) =>
      set((state) => {
        const source = state.categories[from.categoryIndex];
        const question = source?.questions[from.questionIndex];
        if (!question) return state;
        if (sameCard(from, to)) return state;

        const categories = state.categories.map((cat) => ({
          ...cat,
          questions: [...cat.questions],
        }));

        categories[from.categoryIndex].questions.splice(from.questionIndex, 1);

        const target = categories[to.categoryIndex];
        if (!target) return state;
        const index = Math.max(
          0,
          Math.min(to.questionIndex, target.questions.length)
        );
        target.questions.splice(index, 0, question);

        return {
          categories: normalizePoints(categories),
          selectedCard: { categoryIndex: to.categoryIndex, questionIndex: index },
        };
      }),

    updateQuestion: (
```

Replace with:

```ts
    updateQuestion: (
```

Find:

```ts
    moveQuestion: withUnsavedChanges(actions.moveQuestion, set),
    moveCard: withUnsavedChanges(actions.moveCard, set),
```

Replace with:

```ts
    moveQuestion: withUnsavedChanges(actions.moveQuestion, set),
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: passes — no remaining references to `moveCard`.

- [ ] **Step 4: Commit**

```bash
git add utils/types.ts utils/store.ts
git commit -m "refactor: remove the unused moveCard action"
```

---

### Task 9: Verify in the running app

No component-test infrastructure exists (see Del 1's Task 2 note) — this is
a browser verification task.

**Files:** possibly `components/editor/EditableBoard.tsx` (tuning
`EDITOR_CHROME`) if Step 1 doesn't land on the spec's number.

- [ ] **Step 1: Geometry — tune `EDITOR_CHROME` against the spec's example**

Open the editor with 5 categories at a 1920px-wide viewport and the
inspector visible (≥1280px so it's a column, not a sheet). Measure a card's
`getBoundingClientRect()` via `javascript_tool`. Target: 248×157 (see
Assumption 1). If it's off, adjust `EDITOR_CHROME` in
`components/editor/EditableBoard.tsx` and re-measure — this is the same
"formula plus one browser-verified constant" approach Del 1 used for its
own acceptance table, not a guess left unchecked.

- [ ] **Step 2: No wrapping, no scroll surprises**

With 7+ categories, confirm the board scrolls horizontally
(`overflow-x-auto`) rather than wrapping category columns onto a second
row. Confirm "Ny kategori" is a full-height column at the end, not a small
button below the grid.

- [ ] **Step 3: Card content**

Confirm each card shows: points at a fixed, clearly larger size than
before; JOKER/code/image badges; a status dot; and, on an incomplete card,
the status text (e.g. "Mangler svar") visibly on the card, not only as a
color.

- [ ] **Step 4: Points field, move buttons**

Select a card, change its points via the new number input, confirm it
updates on the card immediately, and confirm it does **not** get silently
reset by unrelated edits to sibling cards. Click "Flytt opp"/"Flytt ned"
and confirm the inspector follows the card to its new position (still
showing the same question/answer, not the sibling that swapped places).

- [ ] **Step 5: Delete confirmation**

Click "Slett kortet" and confirm a dialog appears naming the points and
category before anything is removed; cancel and confirm nothing changed;
confirm and confirm the card is gone and the inspector closes.

- [ ] **Step 6: autoFocus**

Click a card, then immediately press `→` (arrow right) without clicking
into any field first. Confirm it advances to the next card in the queue
(this was broken before: `autoFocus` on the question field ate the
keystroke).

- [ ] **Step 7: BoardTransfer confirmation**

With a non-empty board, try "Lim inn spørsmål" → "Erstatt brettet" → "Les
inn": confirm a dialog appears naming how many categories will disappear
before anything happens. Same for "Importer JSON" with an existing board.
Confirm "Legg til" (append) mode does **not** prompt (nothing is lost).
Confirm an *empty* board doesn't prompt either (nothing to lose).

- [ ] **Step 8: EditorBar readiness**

With a fully complete board but no title and no teams, confirm the chip
reads something like "tittel, lag mangler" instead of "Klar". Fill in a
title and add a team; confirm it becomes "Klar".

- [ ] **Step 9: Run the full test suite, type-check, and build**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 10: Commit if any step required fixes**

```bash
git add -A
git commit -m "fix: editor board verification fixes"
```

(Skip this commit if no fixes were needed.)

---

## Self-Review Notes

- **Spec coverage:** all 10 numbered items in Del 5 map to a task —
  geometry (Tasks 1-3), card content incl. visible status text (Task 3),
  floating inspector (Task 7), points field (Task 4), moveQuestion/moveCard
  (Tasks 4 and 8), confirmed delete (Task 4), autoFocus (Task 4), full-
  height "new category" + per-column "Kort" row (Task 3), BoardTransfer
  confirmation (Task 6), readiness chip (Task 5).
- **Placeholder scan:** clean — every step is literal file content or an
  exact find/replace; the one open number (`EDITOR_CHROME`) is explicitly
  flagged as an estimate to tune in Task 9, not hidden as if it were exact.
- **Type consistency:** `BoardGeometryInput`'s two new optional fields
  (`panelWidth`, `boardHeightOverride`) are used with the same names in
  `computeBoardGeometry` (Task 1), `useBoardGeometry`'s options object
  (Task 2, renamed to `panelWidthClamp`/`boardHeightOverride` at that
  layer — documented, not accidental), and `EditableBoard.tsx`'s call
  (Task 3) — checked, no drift. `moveQuestion`'s signature
  (`categoryIndex, questionIndex, direction`) matches between `types.ts`
  (unchanged by this plan) and its two new call sites in
  `QuestionInspector.tsx` (Task 4).
