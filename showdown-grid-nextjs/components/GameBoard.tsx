"use client";

import { useCallback } from "react";
import { useGameStore } from "@/utils/store";
import { QuestionModal } from "./QuestionModal";
import { RotateCcw } from "lucide-react";
import type { Question } from "@/utils/types";

export function GameBoard() {
  const categories = useGameStore((state) => state.categories);
  const setLastQuestion = useGameStore((state) => state.setLastQuestion);
  const toggleQuestionAnswered = useGameStore((state) => state.toggleQuestionAnswered);

  const handleQuestionClick = useCallback(
    (categoryName: string, question: Question, questionIndex: number) => {
      // Prevent opening if answered (since we removed disabled attribute)
      if (question.answered) return;
      setLastQuestion({ ...question, categoryName, questionIndex });
    },
    [setLastQuestion]
  );

  const handleRightClick = useCallback(
    (e: React.MouseEvent, categoryName: string, question: Question, questionIndex: number) => {
      e.preventDefault();
      if (!question.answered) return;

      // Confirm before re-opening
      if (confirm(`Re-åpne dette spørsmålet (${question.points} poeng)?`)) {
        toggleQuestionAnswered(categoryName, questionIndex, false);
      }
    },
    [toggleQuestionAnswered]
  );

  const handleResetClick = useCallback(
    (e: React.MouseEvent, categoryName: string, questionIndex: number, points: number) => {
      e.stopPropagation(); // Forhindre at button onClick trigges

      if (confirm(`Re-åpne dette spørsmålet (${points} poeng)?`)) {
        toggleQuestionAnswered(categoryName, questionIndex, false);
      }
    },
    [toggleQuestionAnswered]
  );

  return (
    <section className="flex-grow w-full max-w-7xl mx-auto">
      <div
        className="grid gap-4 h-full"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))" }}
      >
        {categories.map((category, categoryIndex) => (
          <div key={categoryIndex} className="text-center flex flex-col gap-4">
            <div className="category-header">
              <span className="text-base md:text-lg">{category.name}</span>
            </div>

            {category.questions.map((question, questionIndex) => {
              const disabled = question.answered;
              return (
                <button
                  key={questionIndex}
                  onClick={() => handleQuestionClick(category.name, question, questionIndex)}
                  onContextMenu={(e) => handleRightClick(e, category.name, question, questionIndex)}
                  className={`tile h-24 flex items-center justify-center relative ${
                    disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : "cursor-pointer"
                  }`}
                  title={disabled ? "Klikk reset-ikonet eller høyreklikk for å re-åpne" : undefined}
                >
                  {/* Reset-ikon - vises kun på disabled spørsmål */}
                  {disabled && (
                    <button
                      onClick={(e) => handleResetClick(e, category.name, questionIndex, question.points)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-background hover:scale-110 transition-all group pointer-events-auto"
                      title="Re-åpne spørsmål"
                      aria-label="Re-åpne spørsmål"
                    >
                      <RotateCcw className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:rotate-180 transition-all duration-300" />
                    </button>
                  )}

                  {/* Points chip */}
                  <span className="points-chip">{question.points}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <QuestionModal />
    </section>
  );
}