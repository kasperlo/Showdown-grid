import { create } from "zustand";
import type {
  GameState,
  Category,
  Team,
  Question,
  RoundState,
  AdjustmentEntry,
} from "../types";
import { gameData as initialGameData } from "./questions";
import brain from "brain";

const initialRoundState = (): RoundState => ({
  active: false,
  positiveTeamId: null as string | null,
  negativeAwardedTo: [] as string[],
});

const defaultQuestions = (): Question[] =>
  [100, 200, 300, 400, 500].map((points) => ({
    points,
    question: "",
    answer: "",
    imageUrl: "",
    isJoker: false,
    jokerTask: "",
    answered: false,
  }));

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Hjelpefunksjon for å markere endringer som "dirty"
const withUnsavedChanges = <T extends (...args: any[]) => any>(
  fn: T,
  set: (
    partial:
      | GameState
      | Partial<GameState>
      | ((state: GameState) => GameState | Partial<GameState>),
    replace?: boolean | undefined
  ) => void
): T => {
  return ((...args: Parameters<T>) => {
    set({ hasUnsavedChanges: true });
    return fn(...args);
  }) as T;
};

export const useGameStore = create<GameState>()((set, get) => {
  const actions = {
    setCategories: (categories: Category[]) => set({ categories }),

    addCategory: () =>
      set((state) => ({
        categories: [
          ...state.categories,
          {
            name: `Ny Kategori ${state.categories.length + 1}`,
            questions: defaultQuestions(),
          },
        ],
      })),

    removeCategory: (index: number) =>
      set((state) => ({
        categories: state.categories.filter((_, i) => i !== index),
      })),

    addTeam: () =>
      set((state) => {
        const newId = genId();
        return {
          teams: [
            ...state.teams,
            {
              id: newId,
              name: `Team ${state.teams.length + 1}`,
              score: 0,
              players: [],
            },
          ],
        };
      }),

    removeTeam: (id: string) =>
      set((state) => ({ teams: state.teams.filter((t) => t.id !== id) })),

    updateTeamName: (id: string, name: string) =>
      set((state) => ({
        teams: state.teams.map((t) => (t.id === id ? { ...t, name } : t)),
      })),

    updateTeamPlayers: (id: string, players: string[]) =>
      set((state) => ({
        teams: state.teams.map((t) => (t.id === id ? { ...t, players } : t)),
      })),
    setLastQuestion: (question: any) => {
      set({
        lastQuestion: question,
        isQuestionOpen: !!question,
        round: initialRoundState(),
      });
    },

    setQuestionOpen: (open: boolean) => set({ isQuestionOpen: open }),

    markQuestionAsAnswered: (categoryName: string, questionIndex: number) => {
      set((state) => ({
        categories: state.categories.map((cat) => {
          if (cat.name !== categoryName) return cat;
          const qs = [...cat.questions];
          const q = qs[questionIndex];
          if (q) qs[questionIndex] = { ...q, answered: true };
          return { ...cat, questions: qs };
        }),
      }));
    },
    resetGame: () => {
      const resetCategories = get().categories.map((cat) => ({
        ...cat,
        questions: cat.questions.map((q) => ({ ...q, answered: false })),
      }));
      const resetTeams = get().teams.map((t) => ({ ...t, score: 0 }));

      set({
        categories: resetCategories,
        teams: resetTeams,
        lastQuestion: null,
        isQuestionOpen: false,
        round: initialRoundState(),
        adjustmentLog: [],
      });
    },

    awardPositive: (teamId: string) => {
      const { lastQuestion, round } = get();
      if (!lastQuestion || round.positiveTeamId) return;

      get().markQuestionAsAnswered(
        lastQuestion.categoryName,
        lastQuestion.questionIndex
      );

      set((state) => {
        return {
          teams: state.teams.map((t) =>
            t.id === teamId
              ? { ...t, score: t.score + lastQuestion.points }
              : t
          ),
          round: { ...state.round, positiveTeamId: teamId },
        };
      });
    },

    awardNegative: (teamId: string) => {
      const { lastQuestion, round } = get();
      if (
        !lastQuestion ||
        round.positiveTeamId ||
        round.negativeAwardedTo.includes(teamId)
      )
        return;

      const penalty = -Math.round(lastQuestion.points * 0.5);

      set((state) => ({
        teams: state.teams.map((t) =>
          t.id === teamId ? { ...t, score: t.score + penalty } : t
        ),
        round: {
          ...state.round,
          negativeAwardedTo: [...state.round.negativeAwardedTo, teamId],
        },
      }));
    },

    endRound: () => {
      const { round, lastQuestion } = get();
      if (round.active && lastQuestion) {
        get().markQuestionAsAnswered(
          lastQuestion.categoryName,
          lastQuestion.questionIndex
        );
      }
      set({
        lastQuestion: null,
        isQuestionOpen: false,
        round: initialRoundState(),
      });
    },
    manualAdjustScore: (teamId: string, delta: number, reason: string) =>
      set((state) => {
        const team = state.teams.find((t) => t.id === teamId);
        if (!team || !Number.isFinite(delta) || delta === 0) return state;

        const entry: AdjustmentEntry = {
          id: genId(),
          teamId,
          teamNameSnapshot: team.name,
          delta,
          reason,
          createdAt: Date.now(),
          type: "manual",
        };

        return {
          teams: state.teams.map((t) =>
            t.id === teamId ? { ...t, score: t.score + delta } : t
          ),
          adjustmentLog: [entry, ...state.adjustmentLog],
        };
      }),

    undoLastAdjustment: () => {
      set((state) => {
        const last = state.adjustmentLog[0];
        if (!last) return state;
        return {
          teams: state.teams.map((t) =>
            t.id === last.teamId ? { ...t, score: t.score - last.delta } : t
          ),
          adjustmentLog: state.adjustmentLog.slice(1),
        };
      });
    },
    setGameTitle: (title: string) => set({ gameTitle: title }),
    setGameDescription: (description: string) =>
      set({ gameDescription: description }),
  };

  return {
    categories: initialGameData.map((category) => ({
      name: category.name,
      questions: category.questions.map((q) => ({
        points: q.points,
        question: q.question,
        answer: q.answer,
        imageUrl: q.imageUrl,
        isJoker: q.isJoker,
        jokerTask: q.jokerTask,
        answered: false,
      })),
    })),

    teams: [
      { id: "1", name: "Team 1", score: 0, players: ["Player 1"] },
      { id: "2", name: "Team 2", score: 0, players: ["Player 1"] },
      { id: "3", name: "Team 3", score: 0, players: ["Player 1"] },
    ],
    lastQuestion: null,
    isQuestionOpen: false,
    round: initialRoundState(),
    adjustmentLog: [],
    gameTitle: "Showdown Grid",
    gameDescription: "A Jeopardy-style quiz game.",
    isLoading: true, // Starter som true nå
    isSaving: false,
    error: null,
    hasUnsavedChanges: false,

    // Wrap alle muterende handlinger
    setCategories: withUnsavedChanges(actions.setCategories, set),
    addCategory: withUnsavedChanges(actions.addCategory, set),
    removeCategory: withUnsavedChanges(actions.removeCategory, set),
    addTeam: withUnsavedChanges(actions.addTeam, set),
    removeTeam: withUnsavedChanges(actions.removeTeam, set),
    updateTeamName: withUnsavedChanges(actions.updateTeamName, set),
    updateTeamPlayers: withUnsavedChanges(actions.updateTeamPlayers, set),
    markQuestionAsAnswered: withUnsavedChanges(
      actions.markQuestionAsAnswered,
      set
    ),
    resetGame: withUnsavedChanges(actions.resetGame, set),
    awardPositive: withUnsavedChanges(actions.awardPositive, set),
    awardNegative: withUnsavedChanges(actions.awardNegative, set),
    manualAdjustScore: withUnsavedChanges(actions.manualAdjustScore, set),
    undoLastAdjustment: withUnsavedChanges(actions.undoLastAdjustment, set),
    setGameTitle: withUnsavedChanges(actions.setGameTitle, set),
    setGameDescription: withUnsavedChanges(actions.setGameDescription, set),

    // Ikke-muterende handlinger
    setLastQuestion: actions.setLastQuestion,
    setQuestionOpen: actions.setQuestionOpen,
    endRound: actions.endRound,

    loadQuizFromDB: async () => {
      set({ isLoading: true, error: null });
      try {
        const response = await brain.get_user_quiz();
        
        // Sjekk status før vi prøver å parse JSON
        if (response.status === 404) {
          console.log("No saved quiz found for user, using initial state.");
          set({ isLoading: false, hasUnsavedChanges: false });
          return;
        }
        
        if (!response.ok) {
          throw new Error(`Failed to load quiz: ${response.status}`);
        }
        
        const quizData = await response.json();

        // Fullstendig overskriv state med data fra databasen
        set({ ...quizData.data, isLoading: false, hasUnsavedChanges: false });
      } catch (error: any) {
        console.error("Failed to load quiz from DB:", error);
        // For nye brukere, bruk default state i stedet for å vise feilmelding
        set({
          isLoading: false,
          hasUnsavedChanges: false,
          error: null, // Ikke vis feil for nye brukere
        });
      }
    },

    saveQuizToDB: async () => {
      // Ikke lagre hvis ingenting er endret
      if (!get().hasUnsavedChanges && !get().isSaving) return;

      set({ isSaving: true, error: null });
      try {
        const {
          categories,
          teams,
          gameTitle,
          gameDescription,
          adjustmentLog,
        } = get();

        const quizStateToSave = {
          categories,
          teams,
          gameTitle,
          gameDescription,
          adjustmentLog,
        };

        await brain.save_user_quiz({ data: quizStateToSave });
        set({ isSaving: false, hasUnsavedChanges: false });
      } catch (error) {
        console.error("Failed to save quiz to DB:", error);
        set({ isSaving: false, error: "Klarte ikke å lagre quiz." });
      }
    },
  };
});
