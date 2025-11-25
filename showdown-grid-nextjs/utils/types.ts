export interface Question {
  points: number;
  question: string;
  answer: string;
  imageUrl?: string;
  answered: boolean;
  isJoker?: boolean;
  jokerTask?: string;
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
  imageUrl?: string;
  answered?: boolean;
  isJoker?: boolean;
  jokerTask?: string;
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
  type: "manual";
}

export type QuizTheme = "classic" | "modern" | "christmas";

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
}

// Quiz Run types for history and statistics
export interface TeamResult {
  teamId: string;
  teamName: string;
  finalScore: number;
  rank: number;
}

export interface QuizRunFinalState {
  categories: Category[];
  teams: Team[];
  adjustmentLog: AdjustmentEntry[];
}

export interface QuizRun {
  id: string;
  quiz_id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
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
}

export interface QuizRunSummary {
  id: string;
  quiz_title: string;
  ended_at: string;
  duration_seconds: number;
  total_questions: number;
  answered_questions: number;
  completion_percentage: number;
  winning_team_name: string | null;
  winning_score: number | null;
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

  setLastQuestion: (question: LastQuestion | null) => void;
  setQuestionOpen: (open: boolean) => void;

  addTeam: () => void;
  removeTeam: (id: string) => void;
  updateTeamName: (id: string, name: string) => void;
  updateTeamPlayers: (id: string, players: string[]) => void;

  updateScore: (teamId: string, points: number) => void;
  setCategories: (categories: Category[]) => void;
  addCategory: () => void;
  removeCategory: (index: number) => void;
  markQuestionAsAnswered: (categoryName: string, questionIndex: number) => void;

  resetGame: () => void;

  awardPositive: (teamId: string) => void;
  awardNegative: (teamId: string) => void;
  endRound: () => void;

  // Turn management
  setCurrentTurn: (teamId: string) => void;
  initializeTurn: () => void;
  nextTurn: () => void;

  manualAdjustScore: (teamId: string, delta: number, reason?: string) => void;
  undoLastAdjustment: () => void;
  clearAdjustmentLog?: () => void;

  // Database sync
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  saveQuizToDB: () => Promise<void>;
  loadQuizFromDB: () => Promise<void>;

  // Quiz metadata
  quizTitle: string;
  quizDescription: string;
  quizTimeLimit: number | null;
  quizTheme: QuizTheme;
  quizIsPublic: boolean;
  setQuizTitle: (title: string) => void;
  setQuizDescription: (description: string) => void;
  setQuizTimeLimit: (timeLimit: number | null) => void;
  setQuizTheme: (theme: QuizTheme) => void;
  setQuizIsPublic: (isPublic: boolean) => void;

  // Multiple quizzes support
  activeQuizId: string | null;
  activeQuizOwnerId: string | null;
  quizzesList: QuizMetadata[];
  loadQuizzesList: () => Promise<void>;
  switchQuiz: (quizId: string) => Promise<void>;
  loadPublicQuiz: (quizId: string) => Promise<void>;
  createNewQuiz: (title: string, description?: string) => Promise<void>;
  deleteQuiz: (quizId: string) => Promise<void>;

  // Quiz run tracking
  currentRunStartTime: number | null;
  setRunStartTime: (time: number | null) => void;
  saveQuizRun: () => Promise<void>;
}
