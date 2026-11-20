import type { CardRef, QueueFilter } from "./card-status";

export interface Question {
  points: number;
  question: string;
  answer: string;
  /**
   * A code snippet shown below the question, monospaced with its line breaks
   * kept. A separate field rather than markdown fences inside `question`: the
   * card needs to ask something ("Hva printes?") AND show the code, and parsing
   * fences out of free text guesses at intent.
   */
  code?: string;
  /**
   * Shown to the room under the answer, once it has been revealed. A place for
   * the sentence that turns "true false" into something the room learns from,
   * without lengthening the question itself.
   */
  explanation?: string;
  imageUrl?: string;
  answered: boolean;
  isJoker?: boolean;
  jokerTask?: string;
  /** Seconds for this joker card. Null means the quiz's own joker default. */
  jokerTimer?: number | null;
}

export interface Category {
  /**
   * What answered cards are keyed on. Names can repeat and the server rewrites
   * empty or overlong ones, so keying on the name let two columns share one
   * "used" state and made cards playable again after a reload.
   */
  id?: string;
  name: string;
  questions: Question[];
}

/**
 * Who picks the next card. "winner": the team that answered correctly, with
 * the next team in order when nobody did. "rotation": the teams take turns in
 * order, whoever answers.
 */
export type TurnRule = "winner" | "rotation";

/** A team as one playthrough knows it: the roster, without the score. */
export interface LiveTeam {
  id: string;
  name: string;
  players: string[];
}

export interface Team {
  id: string;
  name: string;
  score: number;
  players: string[];
}

export interface LastQuestion {
  categoryId: string;
  categoryName: string;
  questionIndex: number;
  points: number;
  question: string;
  answer: string;
  code?: string;
  explanation?: string;
  imageUrl?: string;
  answered?: boolean;
  isJoker?: boolean;
  jokerTask?: string;
  jokerTimer?: number | null;
}

export interface RoundProgress {
  active: boolean;
  positiveTeamId: string | null;
  negativeAwardedTo: string[];
  /** Log entries created in this round, so cancelling can take them back. */
  entryIds: string[];
  positiveEntryId: string | null;
}

/** The last card that was played to the end, kept so it can be undone. */
export interface CompletedRound {
  categoryId: string;
  categoryName: string;
  questionIndex: number;
  points: number;
  entryIds: string[];
  turnBefore: string | null;
}

/**
 * A round's four screens: question -> answer -> award -> awarded. A joker
 * card skips answer, going straight from question to award.
 */
export type RoundStep = "question" | "answer" | "award" | "awarded" | null;

export interface AdjustmentEntry {
  id: string;
  teamId: string;
  teamNameSnapshot: string;
  delta: number;
  reason?: string;
  createdAt: number;
  type: "manual" | "custom_scoring" | "award" | "penalty";
}

export type QuizTheme = "classic" | "modern" | "christmas";

/** What a quiz is, with nothing from any single playthrough in it. */
export interface QuizTemplate {
  categories: Category[];
  teams: Team[];
  quizTitle: string;
  quizDescription: string;
  quizTimeLimit: number | null;
  jokerTimeLimit: number | null;
  quizTheme: QuizTheme;
  quizIsPublic: boolean;
  turnRule: TurnRule;
}

/** What happened during one playthrough. Stored in quiz_runs.final_state. */
export interface LiveGameState {
  /**
   * One key per answered question: `id:<categoryId>|<index>`. Runs written
   * before categories had ids use `<categoryName>|<index>`; both are read.
   */
  answeredKeys: string[];
  scores: Record<string, number>;
  adjustmentLog: AdjustmentEntry[];
  currentTurnTeamId: string | null;
  /**
   * The teams this playthrough was played with. Absent in older runs, where
   * the quiz's own teams apply. A public quiz cannot save teams to the quiz,
   * so without this a team added at the table was gone after a reload.
   */
  teams?: LiveTeam[];
  /** When something last happened on the board, so history shows when the
   * game was played rather than when it was archived. */
  lastActionAt?: number | null;
  /** 1 = the old shape that stored whole categories/teams arrays. */
  version: 1 | 2;
}

export type SaveStatus =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "error"
  | "readonly";

/**
 * The review queue behind the side panel. `active` is what separates the two
 * ways into the panel: clicking a card gives a silent queue over the whole
 * board, while "Gå gjennom N mangler" shows the counter and the progress bar.
 */
export interface CardQueue {
  filter: QueueFilter;
  categoryIndex?: number;
  ids: CardRef[];
  position: number;
  active: boolean;
}

export interface QuizMetadata {
  id: string;
  title: string;
  description: string;
  is_public: boolean;
  time_limit: number | null;
  theme: QuizTheme;
  created_at: string;
  updated_at: string;
  user_id?: string;
  /** Filled by the list endpoints so cards can show how complete a quiz is. */
  question_count?: number;
  category_count?: number;
  isOwnedByCurrentUser?: boolean;
  is_active?: boolean;
}

// Quiz Run types for history and statistics
export interface TeamResult {
  teamId: string;
  teamName: string;
  finalScore: number;
  rank: number;
  players?: string[];
}

/**
 * Runs written before the template/live split stored the whole board. Both
 * shapes are read; only the compact one is written.
 */
export type QuizRunFinalState =
  | LiveGameState
  | {
      categories: Category[];
      teams: Team[];
      adjustmentLog: AdjustmentEntry[];
    };

export interface QuizRun {
  id: string;
  /** Null once the quiz itself has been deleted; the run stays in history. */
  quiz_id: string | null;
  user_id: string;
  started_at: string;
  ended_at: string | null; // NULL for live sessions
  duration_seconds: number | null; // NULL for live sessions
  quiz_title: string;
  quiz_description: string | null;
  quiz_theme: string | null;
  quiz_time_limit: number | null;
  final_state: QuizRunFinalState;
  total_questions: number;
  answered_questions: number;
  completion_percentage: number;
  team_results: TeamResult[];
  winning_team_name: string | null;
  winning_score: number | null;
  created_at: string;
  updated_at?: string; // Timestamp of last update
}

/** What peekActiveSession reports, before anything is applied to the store. */
export interface ActiveSessionSummary {
  runId: string;
  startedAt: string;
  answered: number;
  total: number;
  teams: { name: string; score: number }[];
  hasProgress: boolean;
}

export interface QuizRunSummary {
  id: string;
  quiz_id?: string | null;
  quiz_title: string;
  started_at?: string;
  /** NULL while a session is still live. */
  ended_at: string | null;
  duration_seconds: number | null;
  total_questions: number;
  answered_questions: number;
  completion_percentage: number;
  winning_team_name: string | null;
  winning_score: number | null;
}

export interface CategorySummary {
  name: string;
  total: number;
  answered: number;
}

export interface GameState {
  categories: Category[];
  teams: Team[];

  lastQuestion: LastQuestion | null;
  roundStep: RoundStep;
  round: RoundProgress;

  adjustmentLog: AdjustmentEntry[];

  // Turn tracking
  currentTurnTeamId: string | null;
  isInitialTurnSelection: boolean;

  // Public quiz tracking
  isPlayingPublicQuiz: boolean;

  setLastQuestion: (question: LastQuestion | null) => void;
  /** question -> answer -> award (joker cards skip answer). */
  advanceRoundStep: () => void;
  /** Closes the round as if it never happened: points given in it are taken
   * back and the card stays playable. */
  cancelRound: () => void;

  addTeam: (name?: string) => void;
  removeTeam: (id: string) => void;
  updateTeamName: (id: string, name: string) => void;
  updateTeamPlayers: (id: string, players: string[]) => void;

  setCategories: (categories: Category[]) => void;
  addCategory: () => void;
  removeCategory: (index: number) => void;
  markQuestionAsAnswered: (categoryId: string, questionIndex: number) => void;

  /** Archives the running session first. Resolves false, with the board
   * untouched, when that fails. */
  resetGame: () => Promise<boolean>;

  awardPositive: (teamId: string, customPoints?: number) => void;
  awardNegative: (teamId: string, customPoints?: number) => void;
  endRound: () => void;
  toggleQuestionAnswered: (categoryId: string, questionIndex: number, answered: boolean) => void;

  // Turn management
  turnRule: TurnRule;
  setTurnRule: (rule: TurnRule) => void;
  setCurrentTurn: (teamId: string | null) => void;
  initializeTurn: () => void;
  nextTurn: () => void;

  manualAdjustScore: (teamId: string, delta: number, reason?: string) => void;
  /** Reverses the award that took the round to "awarded", from there only. */
  undoLastAward: () => void;
  lastCompletedRound: CompletedRound | null;
  /** Takes back the last finished card: its points, the card and the turn. */
  undoLastCard: () => void;
  lastActionAt: number | null;

  // Database sync
  isLoading: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: number | null;
  /** Fingerprint of the template as last loaded or saved for the active quiz. */
  templateBaseline: string | null;
  /** The quiz row's updated_at as last seen, sent with every save. */
  quizUpdatedAt: string | null;
  /** Someone else saved the quiz since it was loaded; saving stops. */
  saveConflict: boolean;
  /** The last write of the live game failed. */
  sessionSaveFailed: boolean;
  /** True once a quiz (or the decision that there is none) has been loaded. */
  isHydrated: boolean;
  /** Saves the template if it differs from the last saved one. Resolves to
   * whether nothing is left unsaved. Calls are queued, never overlapping. */
  saveTemplate: (options?: SaveTemplateOptions) => Promise<boolean>;
  /** Resolves when every queued template save has finished, so a load that
   * follows a switch reads what was just saved. */
  waitForTemplateSaves: () => Promise<void>;
  setHydrated: (hydrated: boolean) => void;
  /** Replaces the whole board from a stored template + optional live state. */
  loadQuiz: (input: LoadQuizInput) => void;
  /** Can the signed-in user write to the active quiz? True for the owner and
   * for anyone who joined through a share link. */
  canEditActiveQuiz: () => boolean;
  /** Is the signed-in user the owner (not just a collaborator)? Gates
   * owner-only actions: deleting the quiz, managing the share link. */
  isOwnerOfActiveQuiz: () => boolean;

  // Quiz metadata
  quizTitle: string;
  quizDescription: string;
  quizTimeLimit: number | null;
  jokerTimeLimit: number | null;
  quizTheme: QuizTheme;
  quizIsPublic: boolean;
  setQuizTitle: (title: string) => void;
  setQuizDescription: (description: string) => void;
  setQuizTimeLimit: (timeLimit: number | null) => void;
  setJokerTimeLimit: (timeLimit: number | null) => void;
  setQuizTheme: (theme: QuizTheme) => void;
  setQuizIsPublic: (isPublic: boolean) => void;

  // Multiple quizzes support
  activeQuizId: string | null;
  activeQuizOwnerId: string | null;
  /** Owner-or-collaborator for the active quiz, decided server-side. */
  activeQuizCanEdit: boolean;
  /** Set once auth resolves, so ownership can be decided without a round trip. */
  currentUserId: string | null;
  currentUserEmail: string | null;
  isAnonymousUser: boolean;
  setCurrentUser: (user: {
    id: string | null;
    email?: string | null;
    isAnonymous?: boolean;
  }) => void;
  /**
   * Wipes everything belonging to the signed-in user. Must run on every login
   * and logout: navigation is client-side, so the store outlives the session.
   */
  resetForNewUser: () => void;
  /** Drops the active quiz from memory, for when it has been deleted. */
  unloadQuiz: () => void;
  addQuestionToCategory: (categoryIndex: number) => void;
  removeQuestionFromCategory: (
    categoryIndex: number,
    questionIndex: number
  ) => void;
  duplicateCategory: (categoryIndex: number) => void;
  moveCategory: (categoryIndex: number, direction: -1 | 1) => void;
  moveQuestion: (
    categoryIndex: number,
    questionIndex: number,
    direction: -1 | 1
  ) => void;
  updateQuestion: (
    categoryIndex: number,
    questionIndex: number,
    patch: Partial<Question>
  ) => void;
  renameCategory: (categoryIndex: number, name: string) => void;

  // On-board editing
  editMode: boolean;
  selectedCard: CardRef | null;
  queue: CardQueue | null;
  setEditMode: (on: boolean) => void;
  selectCard: (ref: CardRef | null) => void;
  startQueue: (filter: QueueFilter, categoryIndex?: number) => void;
  closeQueue: () => void;
  queueNext: () => void;
  queuePrev: () => void;
  // Quiz run tracking
  currentRunStartTime: number | null;
  setRunStartTime: (time: number | null) => void;

  // Session management
  activeRunId: string | null;
  startSession: () => Promise<string | null>;
  saveSession: () => Promise<void>;
  /** Writes any pending live state immediately, ignoring the rate limit. */
  flushSession: () => Promise<void>;
  restoreActiveSession: (quizId: string) => Promise<void>;
  /** Applies this browser's copy of a game that never reached the server,
   * for a quiz with no session there. */
  applySnapshotWithoutRun: (quizId: string) => void;
  /** Looks at the active session without applying it — see completeSession
   * for the terminal state and restoreActiveSession for actually applying it.
   * Resolves null when there is none and throws when it could not be checked:
   * treating a failed check as "none" let the next card overwrite the game. */
  peekActiveSession: (quizId: string) => Promise<ActiveSessionSummary | null>;
  completeSession: (runId: string, quizId?: string) => Promise<QuizRun | null>;
}

export interface SaveTemplateOptions {
  /** For page unload: lets the request outlive the page. */
  keepalive?: boolean;
  /** Saves another quiz's template instead of the active one: the quiz being
   * left when the library switches to a new one. */
  target?: {
    quizId: string;
    template: QuizTemplate;
    expectedUpdatedAt: string | null;
  };
}

export interface LoadQuizInput {
  template: QuizTemplate;
  live?: LiveGameState | null;
  quizId: string | null;
  quizOwnerId: string | null;
  /** The quiz row's updated_at, so a save can tell whether it is stale. */
  updatedAt?: string | null;
  runId?: string | null;
  runStartedAt?: number | null;
  isPublicPlay?: boolean;
  /** Owner-or-collaborator, decided server-side. Defaults to false. */
  canEdit?: boolean;
}
