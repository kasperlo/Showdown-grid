"use client";

import { useCallback, useState } from "react";
import { useGameStore } from "@/utils/store";
import { QuestionModal } from "./QuestionModal";
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

export function GameBoard() {
  const categories = useGameStore((state) => state.categories);
  const setLastQuestion = useGameStore((state) => state.setLastQuestion);
  const toggleQuestionAnswered = useGameStore(
    (state) => state.toggleQuestionAnswered
  );
  const [reopenTarget, setReopenTarget] = useState<ReopenTarget | null>(null);

  const handleQuestionClick = useCallback(
    (categoryName: string, question: Question, questionIndex: number) => {
      if (question.answered) return;
      setLastQuestion({ ...question, categoryName, questionIndex });
    },
    [setLastQuestion]
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

  return (
    <section className="w-full">
      {/*
        The board scrolls sideways below ~640px instead of collapsing each
        category onto its own row: a Jeopardy board that is five screens tall
        stops being a board.
      */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:overflow-visible sm:px-0">
        <div
          className="grid min-w-[36rem] gap-2 sm:min-w-0 sm:gap-4"
          style={{
            gridTemplateColumns: `repeat(${categories.length}, minmax(6.5rem, 1fr))`,
          }}
        >
          {categories.map((category, categoryIndex) => (
            <div
              key={`${category.name}-${categoryIndex}`}
              className="flex flex-col gap-2 text-center sm:gap-4"
            >
              <div className="category-header !h-16 px-2 sm:!h-24">
                <span className="line-clamp-3 text-xs leading-tight sm:text-base md:text-lg">
                  {category.name}
                </span>
              </div>

              {category.questions.map((question, questionIndex) => {
                const answered = question.answered;
                const incomplete = !isQuestionComplete(question);

                return (
                  <div key={questionIndex} className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        handleQuestionClick(
                          category.name,
                          question,
                          questionIndex
                        )
                      }
                      disabled={answered}
                      aria-label={
                        answered
                          ? `${category.name}, ${question.points} poeng, brukt`
                          : `${category.name}, ${question.points} poeng`
                      }
                      className={`tile flex h-16 w-full items-center justify-center sm:h-24 ${
                        answered
                          ? "cursor-not-allowed opacity-40"
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
                      <span className="points-chip text-lg sm:text-2xl">
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
                          <Sparkles className="h-3 w-3 text-white" aria-hidden />
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
                        className="absolute right-1 top-1 rounded-full bg-background/80 p-1 transition-all hover:scale-110 hover:bg-background"
                        title="Åpne spørsmålet på nytt"
                        aria-label={`Åpne ${category.name} ${question.points} på nytt`}
                      >
                        <RotateCcw className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
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
                    false
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

      <QuestionModal />
    </section>
  );
}
