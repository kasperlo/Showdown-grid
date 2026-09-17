"use client";

import { useCallback, useState } from "react";
import { useGameStore } from "@/utils/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  MoreVertical,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  countCompleteQuestions,
  countQuestions,
  isQuestionComplete,
} from "@/utils/quiz-template";
import { QuestionEditorDialog, type CellRef } from "./QuestionEditorDialog";

/**
 * The editor is shaped like the board it edits. The previous version was a
 * vertical list of 25 cards, where finding "the 300 in category 4" meant
 * scrolling and counting.
 */
export function BoardEditor() {
  const categories = useGameStore((s) => s.categories);
  const addCategory = useGameStore((s) => s.addCategory);
  const removeCategory = useGameStore((s) => s.removeCategory);
  const renameCategory = useGameStore((s) => s.renameCategory);
  const duplicateCategory = useGameStore((s) => s.duplicateCategory);
  const moveCategory = useGameStore((s) => s.moveCategory);
  const addQuestionToCategory = useGameStore((s) => s.addQuestionToCategory);

  const [openCell, setOpenCell] = useState<CellRef | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);

  const total = countQuestions(categories);
  const complete = countCompleteQuestions(categories);

  const navigate = useCallback(
    (direction: -1 | 1) => {
      setOpenCell((current) => {
        if (!current) return current;
        const flat: CellRef[] = [];
        categories.forEach((category, categoryIndex) =>
          category.questions.forEach((_, questionIndex) =>
            flat.push({ categoryIndex, questionIndex })
          )
        );
        const position = flat.findIndex(
          (c) =>
            c.categoryIndex === current.categoryIndex &&
            c.questionIndex === current.questionIndex
        );
        const next = flat[position + direction];
        return next ?? current;
      });
    },
    [categories]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {complete}/{total}
          </span>{" "}
          felter er ferdige
          {complete < total && " — de tomme har stiplet kant"}
        </div>
        <Button onClick={addCategory} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Ny kategori
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <p className="font-semibold">Ingen kategorier enda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Et vanlig brett har fem kategorier med fem spørsmål hver.
          </p>
          <Button className="mt-4" onClick={addCategory}>
            Legg til den første
          </Button>
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${categories.length}, minmax(11rem, 1fr))`,
            }}
          >
            {categories.map((category, categoryIndex) => (
              <div key={categoryIndex} className="flex flex-col gap-2">
                <div className="tile space-y-2 p-2">
                  <div className="flex items-start gap-1">
                    <Input
                      value={category.name}
                      onChange={(e) =>
                        renameCategory(categoryIndex, e.target.value)
                      }
                      aria-label={`Navn på kategori ${categoryIndex + 1}`}
                      className="h-8 text-sm font-semibold"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          aria-label={`Handlinger for ${category.name}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => addQuestionToCategory(categoryIndex)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Legg til felt
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => duplicateCategory(categoryIndex)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Dupliser kategori
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={categoryIndex === 0}
                          onClick={() => moveCategory(categoryIndex, -1)}
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Flytt til venstre
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={categoryIndex === categories.length - 1}
                          onClick={() => moveCategory(categoryIndex, 1)}
                        >
                          <ArrowRight className="mr-2 h-4 w-4" />
                          Flytt til høyre
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setCategoryToDelete(categoryIndex)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Slett kategori
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-center text-[0.7rem] text-muted-foreground">
                    {category.questions.filter(isQuestionComplete).length}/
                    {category.questions.length} ferdige
                  </p>
                </div>

                {category.questions.map((question, questionIndex) => {
                  const done = isQuestionComplete(question);
                  const preview = question.isJoker
                    ? question.jokerTask
                    : question.question;

                  return (
                    <button
                      key={questionIndex}
                      type="button"
                      onClick={() =>
                        setOpenCell({ categoryIndex, questionIndex })
                      }
                      className={`tile relative flex h-20 flex-col items-center justify-center gap-1 p-2 text-center transition-colors hover:bg-accent/10 ${
                        done ? "" : "border border-dashed border-destructive/50"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        {question.isJoker && (
                          <Sparkles
                            className="h-3 w-3 text-yellow-400"
                            aria-hidden
                          />
                        )}
                        {question.imageUrl && !question.isJoker && (
                          <ImageIcon
                            className="h-3 w-3 text-muted-foreground"
                            aria-hidden
                          />
                        )}
                        <span className="text-lg font-bold text-accent tabular-nums">
                          {question.points}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-[0.7rem] leading-tight text-muted-foreground">
                        {preview?.trim() || "Tomt"}
                      </span>
                    </button>
                  );
                })}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addQuestionToCategory(categoryIndex)}
                  className="h-8 text-xs text-muted-foreground"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Felt
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <QuestionEditorDialog
        cell={openCell}
        onClose={() => setOpenCell(null)}
        onNavigate={navigate}
      />

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
              Kategorien og alle spørsmålene i den forsvinner. Kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (categoryToDelete !== null) removeCategory(categoryToDelete);
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
