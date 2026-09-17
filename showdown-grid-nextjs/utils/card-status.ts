import type { Category, Question } from "./types";

/**
 * What the board knows about itself: which cards are finished, what is missing,
 * and in which order to walk them. All derived — nothing here is stored.
 */

export interface CardRef {
  categoryIndex: number;
  questionIndex: number;
}

export type CardStatus =
  | "complete"
  | "missing-answer"
  | "missing-question"
  | "empty";

export type QueueFilter = "all" | "incomplete" | "category" | "jokers";

export function cardStatus(question: Question): CardStatus {
  if (question.isJoker) {
    return question.jokerTask?.trim() ? "complete" : "empty";
  }

  const hasQuestion = Boolean(question.question.trim());
  const hasAnswer = Boolean(question.answer.trim());

  if (!hasQuestion && !hasAnswer) return "empty";
  if (!hasQuestion) return "missing-question";
  if (!hasAnswer) return "missing-answer";
  return "complete";
}

/** Short label for a status, used on the tile and in the queue list. */
export function statusLabel(status: CardStatus): string | null {
  switch (status) {
    case "empty":
      return "Tomt kort";
    case "missing-answer":
      return "Mangler svar";
    case "missing-question":
      return "Mangler spørsmål";
    default:
      return null;
  }
}

export function isComplete(question: Question): boolean {
  return cardStatus(question) === "complete";
}

/** Reading order: column by column, top to bottom. */
export function allCards(categories: Category[]): CardRef[] {
  const cards: CardRef[] = [];
  categories.forEach((category, categoryIndex) => {
    category.questions.forEach((_, questionIndex) => {
      cards.push({ categoryIndex, questionIndex });
    });
  });
  return cards;
}

export function cardAt(
  categories: Category[],
  ref: CardRef | null
): Question | undefined {
  if (!ref) return undefined;
  return categories[ref.categoryIndex]?.questions[ref.questionIndex];
}

export function sameCard(a: CardRef | null, b: CardRef | null): boolean {
  if (!a || !b) return false;
  return (
    a.categoryIndex === b.categoryIndex && a.questionIndex === b.questionIndex
  );
}

export function buildQueue(
  categories: Category[],
  filter: QueueFilter,
  categoryIndex?: number
): CardRef[] {
  const cards = allCards(categories);

  switch (filter) {
    case "incomplete":
      return cards.filter((ref) => {
        const question = cardAt(categories, ref);
        return question ? cardStatus(question) !== "complete" : false;
      });
    case "jokers":
      return cards.filter((ref) => cardAt(categories, ref)?.isJoker === true);
    case "category":
      return cards.filter((ref) => ref.categoryIndex === categoryIndex);
    case "all":
    default:
      return cards;
  }
}

export interface Readiness {
  total: number;
  complete: number;
  percent: number;
  missing: number;
  withImage: number;
  jokers: number;
}

export function readiness(categories: Category[]): Readiness {
  let total = 0;
  let complete = 0;
  let withImage = 0;
  let jokers = 0;

  categories.forEach((category) => {
    category.questions.forEach((question) => {
      total += 1;
      if (cardStatus(question) === "complete") complete += 1;
      if (question.imageUrl?.trim()) withImage += 1;
      if (question.isJoker) jokers += 1;
    });
  });

  return {
    total,
    complete,
    percent: total > 0 ? Math.round((complete / total) * 100) : 0,
    missing: total - complete,
    withImage,
    jokers,
  };
}

/**
 * Points belong to the POSITION in a column, not to the card.
 *
 * A Jeopardy column has to read 100, 200, 300 … from the top; if points
 * travelled with the card, moving one would leave a column reading
 * 100-200-200-400 and the board looks broken to the room. So after any
 * structural change the ladder is re-applied from the top.
 *
 * The existing values are reused rather than reset to 100-500, so a board built
 * on 200-400-600 keeps its own ladder.
 */
export function ladderFor(previous: number[], count: number): number[] {
  const usable = previous
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (count <= 0) return [];
  if (usable.length === 0) {
    return Array.from({ length: count }, (_, i) => (i + 1) * 100);
  }

  const ladder = usable.slice(0, count);
  const step =
    usable.length >= 2
      ? usable[usable.length - 1] - usable[usable.length - 2]
      : usable[0] || 100;

  while (ladder.length < count) {
    const last = ladder[ladder.length - 1] ?? 0;
    ladder.push(last + (step > 0 ? step : 100));
  }

  return ladder;
}

/** Re-applies each category's ladder by position. */
export function normalizePoints(categories: Category[]): Category[] {
  return categories.map((category) => {
    const ladder = ladderFor(
      category.questions.map((q) => q.points),
      category.questions.length
    );
    return {
      ...category,
      questions: category.questions.map((question, index) => {
        const points = ladder[index] ?? question.points;
        return points === question.points ? question : { ...question, points };
      }),
    };
  });
}
