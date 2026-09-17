import { cardStatus } from "./card-status";
import type {
  AdjustmentEntry,
  Category,
  LiveGameState,
  Question,
  QuizTemplate,
  QuizTheme,
  Team,
} from "./types";

/**
 * The template is what a quiz IS; the live state is what happened while it was
 * played. Writing them to the same place means one game permanently marks every
 * question as answered in the quiz itself, so they are split here and stay split
 * all the way to the database: template in `quizzes.quiz_data`, live state in
 * `quiz_runs.final_state`.
 */

export const DEFAULT_POINTS = [100, 200, 300, 400, 500];

export function emptyQuestion(points: number): Question {
  return {
    points,
    question: "",
    answer: "",
    imageUrl: "",
    isJoker: false,
    jokerTask: "",
    jokerTimer: 10,
    answered: false,
  };
}

export function defaultQuestions(): Question[] {
  return DEFAULT_POINTS.map(emptyQuestion);
}

export function emptyCategory(name: string): Category {
  return { name, questions: defaultQuestions() };
}

/** A blank-but-playable board, used for new quizzes. */
export function starterCategories(count = 5): Category[] {
  return Array.from({ length: count }, (_, i) =>
    emptyCategory(`Kategori ${i + 1}`)
  );
}

export function defaultTeams(): Team[] {
  return [
    { id: "team-1", name: "Lag 1", score: 0, players: [] },
    { id: "team-2", name: "Lag 2", score: 0, players: [] },
    { id: "team-3", name: "Lag 3", score: 0, players: [] },
  ];
}

interface TemplateSource {
  categories: Category[];
  teams: Team[];
  quizTitle: string;
  quizDescription: string;
  quizTimeLimit: number | null;
  jokerTimeLimit: number | null;
  quizTheme: QuizTheme;
  quizIsPublic: boolean;
}

/**
 * Strips everything that belongs to a single playthrough. `answered` and
 * `score` are reset rather than omitted so the shape stays identical to what
 * the app loads — an omitted field would read as `undefined` in older rows.
 */
export function extractTemplate(state: TemplateSource): QuizTemplate {
  return {
    categories: state.categories.map((category) => ({
      name: category.name,
      questions: category.questions.map((q) => ({
        points: q.points,
        question: q.question,
        answer: q.answer,
        imageUrl: q.imageUrl ?? "",
        isJoker: Boolean(q.isJoker),
        jokerTask: q.jokerTask ?? "",
        jokerTimer: q.jokerTimer ?? 10,
        answered: false,
      })),
    })),
    teams: state.teams.map((team) => ({
      id: team.id,
      name: team.name,
      players: [...team.players],
      score: 0,
    })),
    quizTitle: state.quizTitle,
    quizDescription: state.quizDescription,
    quizTimeLimit: state.quizTimeLimit,
    jokerTimeLimit: state.jokerTimeLimit,
    quizTheme: state.quizTheme,
    quizIsPublic: state.quizIsPublic,
  };
}

interface LiveSource {
  categories: Category[];
  teams: Team[];
  adjustmentLog: AdjustmentEntry[];
  currentTurnTeamId: string | null;
}

/**
 * The per-playthrough delta. Answered questions are addressed by
 * `category|index` rather than by position so that editing the board between
 * sessions cannot silently shift which questions look used.
 */
export function extractLiveState(state: LiveSource): LiveGameState {
  const answeredKeys: string[] = [];
  state.categories.forEach((category) => {
    category.questions.forEach((question, index) => {
      if (question.answered) answeredKeys.push(answeredKey(category.name, index));
    });
  });

  return {
    answeredKeys,
    scores: Object.fromEntries(state.teams.map((t) => [t.id, t.score])),
    adjustmentLog: state.adjustmentLog,
    currentTurnTeamId: state.currentTurnTeamId,
    version: 2,
  };
}

export function answeredKey(categoryName: string, questionIndex: number): string {
  return `${categoryName}|${questionIndex}`;
}

export interface MergedState {
  categories: Category[];
  teams: Team[];
  adjustmentLog: AdjustmentEntry[];
  currentTurnTeamId: string | null;
}

/**
 * Lays a live state back over a template. Unknown teams and answered keys that
 * no longer exist are dropped silently — the template is the authority on what
 * the board looks like.
 */
export function mergeLiveIntoTemplate(
  template: QuizTemplate,
  live: LiveGameState | null
): MergedState {
  const answered = new Set(live?.answeredKeys ?? []);
  const scores = live?.scores ?? {};

  return {
    categories: template.categories.map((category) => ({
      name: category.name,
      questions: category.questions.map((question, index) => ({
        ...question,
        answered: answered.has(answeredKey(category.name, index)),
      })),
    })),
    teams: template.teams.map((team) => ({
      ...team,
      score: Number.isFinite(scores[team.id]) ? scores[team.id] : 0,
    })),
    adjustmentLog: live?.adjustmentLog ?? [],
    currentTurnTeamId:
      live?.currentTurnTeamId &&
      template.teams.some((t) => t.id === live.currentTurnTeamId)
        ? live.currentTurnTeamId
        : null,
  };
}

/**
 * Reads a `final_state` row from `quiz_runs`. Rows written before the
 * split stored whole `categories`/`teams` arrays, so both shapes are accepted.
 */
export function liveStateFromRunState(finalState: unknown): LiveGameState | null {
  if (!finalState || typeof finalState !== "object") return null;
  const raw = finalState as Record<string, unknown>;

  if (Array.isArray(raw.answeredKeys)) {
    return {
      answeredKeys: raw.answeredKeys.filter(
        (k): k is string => typeof k === "string"
      ),
      scores: isRecordOfNumbers(raw.scores) ? raw.scores : {},
      adjustmentLog: Array.isArray(raw.adjustmentLog)
        ? (raw.adjustmentLog as AdjustmentEntry[])
        : [],
      currentTurnTeamId:
        typeof raw.currentTurnTeamId === "string" ? raw.currentTurnTeamId : null,
      version: 2,
    };
  }

  // Legacy shape: the whole board was stored in the run.
  const categories = Array.isArray(raw.categories)
    ? (raw.categories as Category[])
    : [];
  const teams = Array.isArray(raw.teams) ? (raw.teams as Team[]) : [];
  if (!categories.length && !teams.length) return null;

  return {
    ...extractLiveState({
      categories,
      teams,
      adjustmentLog: Array.isArray(raw.adjustmentLog)
        ? (raw.adjustmentLog as AdjustmentEntry[])
        : [],
      currentTurnTeamId: null,
    }),
    version: 1,
  };
}

function isRecordOfNumbers(value: unknown): value is Record<string, number> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "number")
  );
}

/**
 * Reads `quizzes.quiz_data`. Old rows kept played state here, so `answered` and
 * `score` are deliberately thrown away on the way in.
 */
export function templateFromQuizData(
  quizData: unknown,
  meta: {
    quizTitle: string;
    quizDescription: string;
    quizTimeLimit: number | null;
    quizTheme: QuizTheme;
    quizIsPublic: boolean;
  }
): QuizTemplate {
  const raw = (quizData && typeof quizData === "object" ? quizData : {}) as Record<
    string,
    unknown
  >;
  const categories = Array.isArray(raw.categories)
    ? (raw.categories as Category[])
    : [];
  const teams = Array.isArray(raw.teams) && raw.teams.length
    ? (raw.teams as Team[])
    : defaultTeams();

  return extractTemplate({
    categories,
    teams,
    quizTitle: meta.quizTitle || "Uten navn",
    quizDescription: meta.quizDescription || "",
    quizTimeLimit: meta.quizTimeLimit,
    jokerTimeLimit:
      typeof raw.jokerTimeLimit === "number" ? raw.jokerTimeLimit : 10,
    quizTheme: meta.quizTheme,
    quizIsPublic: meta.quizIsPublic,
  });
}

/**
 * Change detection for autosave. A string rather than a deep equal so the
 * debounced effect can depend on a primitive and not re-fire on every render.
 */
export function templateFingerprint(template: QuizTemplate): string {
  return JSON.stringify(template);
}

/**
 * One definition of "finished", shared with the editor: see cardStatus. The
 * play board and the review queue disagreeing about which cards are done would
 * be the kind of bug you only notice mid-quiz.
 */
export function isQuestionComplete(question: Question): boolean {
  return cardStatus(question) === "complete";
}

export function countQuestions(categories: Category[]): number {
  return categories.reduce((sum, c) => sum + c.questions.length, 0);
}

export function countCompleteQuestions(categories: Category[]): number {
  return categories.reduce(
    (sum, c) => sum + c.questions.filter(isQuestionComplete).length,
    0
  );
}
