import React from "react";
import { useGameStore } from "utils/store";
import { QuestionModal } from "./QuestionModal";

export function GameBoard() {
  const { categories, setLastQuestion } = useGameStore();

  const handleQuestionClick = (
    categoryName: string,
    question: any,
    questionIndex: number
  ) => {
    if (question.answered) return;
    setLastQuestion({ ...question, categoryName, questionIndex });
  };

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
                  disabled={disabled}
                  className={`tile h-24 flex items-center justify-center ${
                    disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
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