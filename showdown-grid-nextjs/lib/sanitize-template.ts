import type { Category, Team, TurnRule } from "@/utils/types";
import { withCategoryIds } from "@/utils/quiz-template";

/**
 * Server-side guard for what may be written to `quizzes.quiz_data`.
 *
 * The template must never carry played state. This used to be a client concern
 * only, and a single "Lagre" after a game baked `answered: true` and the final
 * scores into the quiz itself. Stripping it here means no client version, old
 * tab or hand-rolled request can do that again.
 */
export interface SanitizedQuizData {
  categories: Category[];
  teams: Team[];
  jokerTimeLimit: number | null;
  turnRule: TurnRule;
}

export function sanitizeQuizData(input: unknown): SanitizedQuizData {
  const raw = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;

  // Ids are kept, and made unique, because answered cards are keyed on them.
  const categories = Array.isArray(raw.categories)
    ? withCategoryIds(
        raw.categories.flatMap((category) => sanitizeCategory(category)),
        "positional"
      )
    : [];

  const teams = Array.isArray(raw.teams)
    ? raw.teams.flatMap((team) => sanitizeTeam(team))
    : [];

  return {
    categories,
    teams,
    jokerTimeLimit:
      typeof raw.jokerTimeLimit === "number" && raw.jokerTimeLimit > 0
        ? Math.round(raw.jokerTimeLimit)
        : null,
    turnRule: raw.turnRule === "rotation" ? "rotation" : "winner",
  };
}

function sanitizeCategory(input: unknown): Category[] {
  if (!input || typeof input !== "object") return [];
  const raw = input as Record<string, unknown>;
  const questions = Array.isArray(raw.questions)
    ? raw.questions.flatMap((q) => sanitizeQuestion(q))
    : [];
  const id = str(raw.id).trim().slice(0, 64);

  return [
    {
      ...(id ? { id } : {}),
      name: str(raw.name).slice(0, 120) || "Uten navn",
      questions,
    },
  ];
}

function sanitizeQuestion(input: unknown): Category["questions"] {
  if (!input || typeof input !== "object") return [];
  const raw = input as Record<string, unknown>;

  return [
    {
      points:
        typeof raw.points === "number" && Number.isFinite(raw.points)
          ? Math.round(raw.points)
          : 0,
      question: str(raw.question).slice(0, 2000),
      answer: str(raw.answer).slice(0, 2000),
      code: str(raw.code).slice(0, 4000),
      explanation: str(raw.explanation).slice(0, 2000),
      imageUrl: str(raw.imageUrl).slice(0, 2000),
      isJoker: raw.isJoker === true,
      jokerTask: str(raw.jokerTask).slice(0, 2000),
      // Null means "the quiz's own joker default".
      jokerTimer:
        typeof raw.jokerTimer === "number" && raw.jokerTimer > 0
          ? Math.min(600, Math.round(raw.jokerTimer))
          : null,
      answered: false,
    },
  ];
}

function sanitizeTeam(input: unknown): Team[] {
  if (!input || typeof input !== "object") return [];
  const raw = input as Record<string, unknown>;
  const id = str(raw.id);
  if (!id) return [];

  return [
    {
      id: id.slice(0, 64),
      name: str(raw.name).slice(0, 80) || "Lag",
      players: Array.isArray(raw.players)
        ? raw.players
            .filter((p): p is string => typeof p === "string")
            .map((p) => p.slice(0, 80))
            .slice(0, 20)
        : [],
      score: 0,
    },
  ];
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
