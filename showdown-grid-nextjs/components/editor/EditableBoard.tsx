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
