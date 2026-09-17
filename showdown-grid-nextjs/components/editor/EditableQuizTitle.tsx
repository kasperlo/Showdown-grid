"use client";

import { useState } from "react";
import { useGameStore } from "@/utils/store";

/**
 * The quiz title, edited where it is shown.
 *
 * No frame at rest: a permanent dashed box around the biggest text on the page
 * is the loudest thing in the room, and it is only needed at the moment you
 * point at it. The description input appears the same way — on hover or focus,
 * or whenever it already has text.
 */
export function EditableQuizTitle() {
  const editMode = useGameStore((s) => s.editMode);
  const quizTitle = useGameStore((s) => s.quizTitle);
  const setQuizTitle = useGameStore((s) => s.setQuizTitle);
  const quizDescription = useGameStore((s) => s.quizDescription);
  const setQuizDescription = useGameStore((s) => s.setQuizDescription);
  const canEdit = useGameStore((s) => s.canEditActiveQuiz());
  const [engaged, setEngaged] = useState(false);

  if (!editMode || !canEdit) {
    return (
      <div className="text-center">
        <h1 className="display-xl break-words text-accent drop-shadow-sm">
          {quizTitle || "Uten navn"}
        </h1>
        {quizDescription && (
          <p className="mt-2 text-base text-muted-foreground sm:text-lg">
            {quizDescription}
          </p>
        )}
      </div>
    );
  }

  const showDescription = engaged || Boolean(quizDescription);

  return (
    <div
      className="text-center"
      onMouseEnter={() => setEngaged(true)}
      onMouseLeave={() => setEngaged(false)}
      onFocusCapture={() => setEngaged(true)}
    >
      <input
        value={quizTitle}
        onChange={(e) => setQuizTitle(e.target.value)}
        placeholder="Uten navn"
        aria-label="Quiztittel"
        title="Tittelen laget ser"
        className="display-xl w-full rounded-lg border border-dashed border-transparent bg-transparent px-3 text-center text-accent outline-none drop-shadow-sm placeholder:text-accent/40 hover:border-accent/50 focus:border-accent"
      />
      {showDescription && (
        <input
          value={quizDescription}
          onChange={(e) => setQuizDescription(e.target.value)}
          placeholder="Beskrivelse"
          aria-label="Beskrivelse"
          className="mt-2 w-full rounded-md border border-dashed border-transparent bg-transparent px-2 text-center text-base text-muted-foreground outline-none placeholder:text-muted-foreground/40 hover:border-border focus:border-accent sm:text-lg"
        />
      )}
    </div>
  );
}
