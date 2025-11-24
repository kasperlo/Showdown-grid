export interface Question {
  points: number;
  question: string;
  answer: string;
  imageUrl?: string;
  answered: boolean;
}

export interface Category {
  name: string;
  questions: Question[];
}

export interface Team {
  id: string;        // string for enkel generering/sortering
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
}

export interface RoundProgress {
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

export interface GameState {
  categories: Category[];
  teams: Team[];

  lastQuestion: LastQuestion | null;
  isQuestionOpen: boolean;
  round: RoundProgress;

  adjustmentLog: AdjustmentEntry[];

  setLastQuestion: (question: LastQuestion | null) => void;
  setQuestionOpen: (open: boolean) => void;

  addTeam: () => void;
  removeTeam: (id: string) => void;
  updateTeamName: (id: string, name: string) => void;
  updateTeamPlayers: (id: string, players: string[]) => void;

  updateScore: (teamId: string, points: number) => void;
  setCategories: (categories: Category[]) => void;
  markQuestionAsAnswered: (categoryName: string, questionIndex: number) => void;

  resetGame: () => void;

  awardPositive: (teamId: string) => void;
  awardNegative: (teamId: string) => void;
  endRound: () => void;

  manualAdjustScore: (teamId: string, delta: number, reason?: string) => void;
  undoLastAdjustment: () => void;
  clearAdjustmentLog?: () => void;
}