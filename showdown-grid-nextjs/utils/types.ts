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
  jokerTimer?: number; // Timer in seconds for this joker question
}

export interface Category {
  name: string;
  questions: Question[];
}

export interface Team {
  id: string;
  name: string;
  score: number;
  players: string[];
}

export interface LastQuestion {
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
  jokerTimer?: number;
}

export interface RoundProgress {
  active: boolean;
  positiveTeamId: string | null;
  negativeAwardedTo: string[];
}

export interface AdjustmentEntry {
  id: string;
  teamId: string;
  teamNameSnapshot: string;
  delta: number;
  reason?: string;
  createdAt: number;
  type: "manual" | "custom_scoring";
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
}

/** What happened during one playthrough. Stored in quiz_runs.final_state. */
export interface LiveGameState {
  /** `categoryName|questionIndex` for every answered question. */
  answeredKeys: string[];
  scores: Record<string, number>;
  adjustmentLog: AdjustmentEntry[];
  currentTurnTeamId: string | null;
  /** 1 = the old shape that stored whole categories/teams arrays. */
  version: 1 | 2;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "readonly";

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
  quiz_id: string;
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

export interface QuizRunSummary {
  id: string;
  quiz_id?: string;
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
  isQuestionOpen: boolean;
  round: RoundProgress;

  adjustmentLog: AdjustmentEntry[];

  // Turn tracking
  currentTurnTeamId: string | null;
  isInitialTurnSelection: boolean;

  // Public quiz tracking
  isPlayingPublicQuiz: boolean;

  setLastQuestion: (question: LastQuestion | null) => void;
  setQuestionOpen: (open: boolean) => void;

  addTeam: (name?: string) => void;
  removeTeam: (id: string) => void;
  updateTeamName: (id: string, name: string) => void;
  updateTeamPlayers: (id: string, players: string[]) => void;

  setCategories: (categories: Category[]) => void;
  addCategory: () => void;
  removeCategory: (index: number) => void;
  markQuestionAsAnswered: (categoryName: string, questionIndex: number) => void;

  resetGame: () => void;

  awardPositive: (teamId: string, customPoints?: number) => void;
  awardNegative: (teamId: string, customPoints?: number) => void;
  endRound: () => void;
  toggleQuestionAnswered: (categoryName: string, questionIndex: number, answered: boolean) => void;

  // Turn management
  setCurrentTurn: (teamId: string | null) => void;
  initializeTurn: () => void;
  nextTurn: () => void;

  manualAdjustScore: (teamId: string, delta: number, reason?: string) => void;
  undoLastAdjustment: () => void;

  // Database sync
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: number | null;
  /** True once a quiz (or the decision that there is none) has been loaded. */
  isHydrated: boolean;
  saveQuizToDB: () => Promise<void>;
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
  /** Moves a card to another position, re-applying the points ladder. */
  moveCard: (from: CardRef, to: CardRef) => void;

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
  completeSession: (runId: string, quizId?: string) => Promise<void>;
}

export interface LoadQuizInput {
  template: QuizTemplate;
  live?: LiveGameState | null;
  quizId: string | null;
  quizOwnerId: string | null;
  runId?: string | null;
  runStartedAt?: number | null;
  isPublicPlay?: boolean;
  /** Owner-or-collaborator, decided server-side. Defaults to false. */
  canEdit?: boolean;
}
