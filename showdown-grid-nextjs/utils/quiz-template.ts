import { cardStatus } from "./card-status";
import type {
  AdjustmentEntry,
  Category,
  LiveGameState,
  LiveTeam,
  Question,
  QuizTemplate,
  QuizTheme,
  Team,
  TurnRule,
} from "./types";

/**
 * The template is what a quiz IS; the live state is what happened while it was
 * played. Writing them to the same place means one game permanently marks every
 * question as answered in the quiz itself, so they are split here and stay split
 * all the way to the database: template in `quizzes.quiz_data`, live state in
 * `quiz_runs.final_state`.
 */

export const DEFAULT_POINTS = [100, 200, 300, 400, 500];
export const DEFAULT_TURN_RULE: TurnRule = "winner";

export function emptyQuestion(points: number): Question {
  return {
    points,
    question: "",
    answer: "",
    code: "",
    explanation: "",
    imageUrl: "",
    isJoker: false,
    jokerTask: "",
    jokerTimer: null,
    answered: false,
  };
}

export function defaultQuestions(): Question[] {
  return DEFAULT_POINTS.map(emptyQuestion);
}

export function newCategoryId(): string {
  return `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyCategory(name: string): Category {
  return { id: newCategoryId(), name, questions: defaultQuestions() };
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

/**
 * Gives every category a unique id. A category without one gets either a fresh
 * random id (anything new, like an import) or one derived from its position
 * (a quiz stored before categories had ids). The positional ids have to come
 * out the same on every load and on the server, or a game played before the
 * quiz is next saved would lose its answered cards on reload.
 */
export function withCategoryIds(
  categories: Category[],
  fallback: "positional" | "random"
): Category[] {
  const seen = new Set<string>();
  return categories.map((category, index) => {
    const stored =
      typeof category.id === "string" ? category.id.trim().slice(0, 64) : "";
    let id = stored || (fallback === "random" ? newCategoryId() : `c${index}`);
    while (seen.has(id)) id = `${id}-${index}`;
    seen.add(id);
    return category.id === id ? category : { ...category, id };
  });
}

function validTurnRule(value: unknown): TurnRule {
  return value === "rotation" ? "rotation" : DEFAULT_TURN_RULE;
}

function positiveSecondsOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
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
  turnRule?: TurnRule;
}

/**
 * Strips everything that belongs to a single playthrough. `answered` and
 * `score` are reset rather than omitted so the shape stays identical to what
 * the app loads — an omitted field would read as `undefined` in older rows.
 */
export function extractTemplate(state: TemplateSource): QuizTemplate {
  return {
    categories: state.categories.map((category) => ({
      id: category.id,
      name: category.name,
      questions: category.questions.map((q) => ({
        points: q.points,
        question: q.question,
        answer: q.answer,
        code: q.code ?? "",
        explanation: q.explanation ?? "",
        imageUrl: q.imageUrl ?? "",
        isJoker: Boolean(q.isJoker),
        jokerTask: q.jokerTask ?? "",
        jokerTimer: positiveSecondsOrNull(q.jokerTimer),
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
    turnRule: validTurnRule(state.turnRule),
  };
}

interface LiveSource {
  categories: Category[];
  teams: Team[];
  adjustmentLog: AdjustmentEntry[];
  currentTurnTeamId: string | null;
  lastActionAt?: number | null;
}

/**
 * The per-playthrough delta. Answered questions are addressed by category id
 * and index rather than by position, so that editing the board between
 * sessions cannot silently shift which questions look used.
 */
export function extractLiveState(state: LiveSource): LiveGameState {
  const answeredKeys: string[] = [];
  state.categories.forEach((category) => {
    category.questions.forEach((question, index) => {
      if (question.answered) answeredKeys.push(answeredKey(category, index));
    });
  });

  return {
    answeredKeys,
    scores: Object.fromEntries(state.teams.map((t) => [t.id, t.score])),
    adjustmentLog: state.adjustmentLog,
    currentTurnTeamId: state.currentTurnTeamId,
    teams: state.teams.map((team) => ({
      id: team.id,
      name: team.name,
      players: [...team.players],
    })),
    lastActionAt: state.lastActionAt ?? null,
    version: 2,
  };
}

export function answeredKey(
  category: Pick<Category, "id" | "name">,
  questionIndex: number
): string {
  return category.id
    ? `id:${category.id}|${questionIndex}`
    : legacyAnsweredKey(category.name, questionIndex);
}

/** The key runs used before categories had ids. */
export function legacyAnsweredKey(categoryName: string, questionIndex: number): string {
  return `${categoryName}|${questionIndex}`;
}

/** Whether a set of answered keys, in either format, marks this card used. */
export function isAnsweredIn(
  answered: Set<string>,
  category: Pick<Category, "id" | "name">,
  questionIndex: number
): boolean {
  return (
    answered.has(answeredKey(category, questionIndex)) ||
    answered.has(legacyAnsweredKey(category.name, questionIndex))
  );
}

export interface MergedState {
  categories: Category[];
  teams: Team[];
  adjustmentLog: AdjustmentEntry[];
  currentTurnTeamId: string | null;
  lastActionAt: number | null;
}

/**
 * Lays a live state back over a template. Answered keys that no longer exist
 * are dropped silently — the template is the authority on what the board looks
 * like. The teams come from the live state when it has them: they are the
 * teams this game was played with, which on a public quiz the template cannot
 * hold.
 */
export function mergeLiveIntoTemplate(
  template: QuizTemplate,
  live: LiveGameState | null
): MergedState {
  const answered = new Set(live?.answeredKeys ?? []);
  const scores = live?.scores ?? {};
  const roster: Omit<Team, "score">[] =
    live?.teams && live.teams.length > 0 ? live.teams : template.teams;

  const teams = roster.map((team) => ({
    id: team.id,
    name: team.name,
    players: [...(team.players ?? [])],
    score: Number.isFinite(scores[team.id]) ? scores[team.id] : 0,
  }));

  return {
    categories: template.categories.map((category) => ({
      ...category,
      questions: category.questions.map((question, index) => ({
        ...question,
        answered: isAnsweredIn(answered, category, index),
      })),
    })),
    teams,
    adjustmentLog: live?.adjustmentLog ?? [],
    currentTurnTeamId:
      live?.currentTurnTeamId &&
      teams.some((t) => t.id === live.currentTurnTeamId)
        ? live.currentTurnTeamId
        : null,
    lastActionAt:
      typeof live?.lastActionAt === "number" ? live.lastActionAt : null,
  };
}

function readLiveTeams(value: unknown): LiveTeam[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const teams = value.flatMap((raw): LiveTeam[] => {
    if (!raw || typeof raw !== "object") return [];
    const team = raw as Record<string, unknown>;
    if (typeof team.id !== "string" || !team.id) return [];
    return [
      {
        id: team.id,
        name: typeof team.name === "string" && team.name ? team.name : "Lag",
        players: Array.isArray(team.players)
          ? team.players.filter((p): p is string => typeof p === "string")
          : [],
      },
    ];
  });
  return teams.length > 0 ? teams : undefined;
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
      teams: readLiveTeams(raw.teams),
      lastActionAt:
        typeof raw.lastActionAt === "number" ? raw.lastActionAt : null,
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
      categories: categories.map((category) => ({ ...category, id: undefined })),
      teams,
      adjustmentLog: Array.isArray(raw.adjustmentLog)
        ? (raw.adjustmentLog as AdjustmentEntry[])
        : [],
      currentTurnTeamId: null,
    }),
    teams: undefined,
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
 *
 * A joker timer of exactly 10 is read as "use the quiz default": every card got
 * 10 when it was made, so the quiz-wide joker setting never applied to any
 * card. A deliberate 10 differs from that only when the default is not 10.
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
    ? withCategoryIds(raw.categories as Category[], "positional").map(
        (category) => ({
          ...category,
          questions: (category.questions ?? []).map((question) => ({
            ...question,
            jokerTimer: question.jokerTimer === 10 ? null : question.jokerTimer,
          })),
        })
      )
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
    turnRule: validTurnRule(raw.turnRule),
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
