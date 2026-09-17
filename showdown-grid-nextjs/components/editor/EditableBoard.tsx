"use client";

import { useState } from "react";
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

/**
 * The board, editable in place. Same grid and the same tiles the room sees, so
 * there is no separate preview to keep in sync — switching to Spill *is* the
 * preview.
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

  const queuePosition = (ref: CardRef): number | null => {
    if (!queue?.active) return null;
    const index = queue.ids.findIndex((id) => sameCard(id, ref));
    return index === -1 ? null : index;
  };

  return (
    <div className="space-y-4">
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(11rem, 1fr))`,
        }}
      >
        {categories.map((category, categoryIndex) => {
          const done = category.questions.filter(
            (q) => cardStatus(q) === "complete"
          ).length;

          return (
            <div key={categoryIndex} className="flex flex-col gap-3">
              <div className="category-header !h-[70px] flex-col gap-1 px-2">
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
                  : question.question.trim();

                return (
                  <div key={questionIndex} className="relative">
                    <button
                      type="button"
                      onClick={() => selectCard(ref)}
                      aria-current={isSelected ? "true" : undefined}
                      className={[
                        "tile flex h-20 w-full flex-col items-start justify-center gap-1 px-2.5 text-left transition-colors hover:!translate-y-0 hover:!scale-100",
                        isSelected
                          ? "turn-highlight border-2 border-accent bg-accent/10"
                          : status === "complete"
                          ? "hover:border-accent/70"
                          : "border border-dashed border-destructive/60 bg-destructive/[0.07] hover:border-destructive",
                      ].join(" ")}
                    >
                      <span className="flex w-full items-center gap-1.5">
                        <span className="text-xl font-extrabold tabular-nums text-accent">
                          {question.points}
                        </span>
                        {question.isJoker && (
                          <span className="rounded-full bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 px-1.5 py-px text-[0.65rem] font-extrabold tracking-wider text-white">
                            JOKER
                          </span>
                        )}
                        {question.imageUrl?.trim() && (
                          <ImageIcon
                            className="h-3 w-3 text-muted-foreground"
                            aria-label="Har bilde"
                          />
                        )}
                        <span
                          className={`ml-auto h-[7px] w-[7px] shrink-0 rounded-full ${
                            status === "complete" ? "bg-success" : "bg-destructive"
                          }`}
                          aria-hidden
                        />
                      </span>

                      <span
                        className={`line-clamp-2 text-xs leading-snug ${
                          label
                            ? "font-semibold text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {preview || label}
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
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-muted-foreground/40 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-accent"
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
          className="flex min-h-[70px] items-center justify-center gap-2 self-start rounded-xl border border-dashed border-muted-foreground/40 px-3 py-5 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          title="Legg til en ny kategori på brettet"
        >
          <Plus className="h-4 w-4" />
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
