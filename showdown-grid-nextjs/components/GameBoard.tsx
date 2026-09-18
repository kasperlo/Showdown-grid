"use client";

import { Fragment, useCallback, useState } from "react";
import { useGameStore } from "@/utils/store";
import { Image as ImageIcon, RotateCcw, Sparkles } from "lucide-react";
import { isQuestionComplete } from "@/utils/quiz-template";
import type { Question } from "@/utils/types";
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

interface ReopenTarget {
  categoryName: string;
  questionIndex: number;
  points: number;
}

/**
 * The board, sized to the height it is given rather than to a fixed tile height.
 *
 * One grid holds every header and tile, placed by column and row, instead of a
 * column of flex stacks. Flexible rows only line up across columns if the rows
 * themselves are shared: with per-column stacks, a category with four questions
 * stretched its tiles taller than its neighbour's five.
 *
 * Type scales with viewport height, because the number on a tile has to be
 * readable from the back of a room on a projector and on a laptop on a sofa.
 */
export function GameBoard() {
  const categories = useGameStore((state) => state.categories);
  const setLastQuestion = useGameStore((state) => state.setLastQuestion);
  const toggleQuestionAnswered = useGameStore(
    (state) => state.toggleQuestionAnswered,
  );
  const [reopenTarget, setReopenTarget] = useState<ReopenTarget | null>(null);

  const handleQuestionClick = useCallback(
    (categoryName: string, question: Question, questionIndex: number) => {
      if (question.answered) return;
      setLastQuestion({ ...question, categoryName, questionIndex });
    },
    [setLastQuestion],
  );

  if (!categories.length) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <p className="text-lg font-semibold">Brettet er tomt</p>
        <p className="mt-2 text-muted-foreground">
          Legg til kategorier og spørsmål i oppsettet før du starter.
        </p>
      </div>
    );
  }

  const rowCount = categories.reduce(
    (most, category) => Math.max(most, category.questions.length),
    0,
  );

  return (
    <>
      {/*
        The board scrolls sideways below ~640px instead of collapsing each
        category onto its own row: a Jeopardy board that is five screens tall
        stops being a board.
      */}
      <div className="-mx-4 flex min-h-0 flex-1 overflow-x-auto px-4 sm:mx-0 sm:overflow-x-visible sm:px-0">
        <div
          // Columns are capped rather than 1fr: a three-category board stretched
          // each tile to 600px on a projector, which reads as a menu, not a
          // Jeopardy board. Seven columns still fill a 1920px screen.
          className="grid min-h-0 w-full min-w-[36rem] justify-center gap-1.5 sm:min-w-0 sm:gap-3"
          style={{
            gridTemplateColumns: `repeat(${categories.length}, var(--col-w))`,
            gridTemplateRows: `var(--head-h) repeat(${rowCount}, var(--tile-h))`,
          }}
        >
          {categories.map((category, categoryIndex) => (
            <Fragment key={`${category.name}-${categoryIndex}`}>
              <div
                className="category-header px-2 py-2"
                style={{ gridColumn: categoryIndex + 1, gridRow: 1 }}
              >
                <span className="line-clamp-3 category-header-label font-bold leading-tight">
                  {category.name}
                </span>
              </div>

              {category.questions.map((question, questionIndex) => {
                const answered = question.answered;
                const incomplete = !isQuestionComplete(question);

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
                      onClick={() =>
                        handleQuestionClick(
                          category.name,
                          question,
                          questionIndex,
                        )
                      }
                      disabled={answered}
                      aria-label={
                        answered
                          ? `${category.name}, ${question.points} poeng, brukt`
                          : `${category.name}, ${question.points} poeng`
                      }
                      className={`tile flex h-full w-full items-center justify-center ${
                        answered
                          ? "cursor-not-allowed opacity-30"
                          : "cursor-pointer"
                      } ${
                        incomplete && !answered
                          ? "ring-1 ring-dashed ring-destructive/50"
                          : ""
                      }`}
                      title={
                        incomplete
                          ? "Mangler spørsmål eller svar — fyll det ut i oppsettet"
                          : undefined
                      }
                    >
                      <span className="points-chip">
                        {question.points}
                      </span>
                    </button>

                    {/* Markers sit outside the button: a button inside a button
                        is invalid HTML and the inner one was unreachable by
                        keyboard. */}
                    <div className="pointer-events-none absolute left-1 top-1 flex gap-1">
                      {question.isJoker && (
                        <span
                          className="rounded-full bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 p-1"
                          title="Joker"
                        >
                          <Sparkles
                            className="h-3 w-3 text-white"
                            aria-hidden
                          />
                          <span className="sr-only">Joker</span>
                        </span>
                      )}
                      {question.imageUrl && !question.isJoker && (
                        <span
                          className="rounded-full bg-background/70 p-1"
                          title="Har bilde"
                        >
                          <ImageIcon
                            className="h-3 w-3 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="sr-only">Har bilde</span>
                        </span>
                      )}
                    </div>

                    {answered && (
                      <button
                        type="button"
                        onClick={() =>
                          setReopenTarget({
                            categoryName: category.name,
                            questionIndex,
                            points: question.points,
                          })
                        }
                        className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition-all hover:scale-110 hover:bg-background focus-visible:opacity-100 group-hover/board:opacity-100"
                        title="Åpne spørsmålet på nytt"
                        aria-label={`Åpne ${category.name} ${question.points} på nytt`}
                      >
                        <RotateCcw className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <AlertDialog
        open={!!reopenTarget}
        onOpenChange={(open) => !open && setReopenTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Åpne spørsmålet på nytt?</AlertDialogTitle>
            <AlertDialogDescription>
              {reopenTarget
                ? `${reopenTarget.categoryName} for ${reopenTarget.points} poeng blir spillbart igjen. Poeng som alt er gitt blir stående.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (reopenTarget) {
                  toggleQuestionAnswered(
                    reopenTarget.categoryName,
                    reopenTarget.questionIndex,
                    false,
                  );
                }
                setReopenTarget(null);
              }}
            >
              Åpne igjen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
