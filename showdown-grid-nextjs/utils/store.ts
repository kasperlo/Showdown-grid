import { create } from "zustand";
import type {
  GameState,
  Category,
  Team,
  Question,
  AdjustmentEntry,
  QuizMetadata,
  QuizTheme,
} from "./types";
import { gameData as initialGameData } from "./questions";

interface RoundState {
  active: boolean;
  positiveTeamId: string | null;
  negativeAwardedTo: string[];
}

const initialRoundState = (): RoundState => ({
  active: false,
  positiveTeamId: null,
  negativeAwardedTo: [],
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

// Helper function to mark changes as "dirty"
const withUnsavedChanges = <T extends (...args: any[]) => any>(
  fn: T,
  set: any
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

    updateScore: (teamId: string, points: number) =>
      set((state) => ({
        teams: state.teams.map((t) =>
          t.id === teamId ? { ...t, score: t.score + points } : t
        ),
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
            t.id === teamId ? { ...t, score: t.score + lastQuestion.points } : t
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

      // Move to next team's turn
      get().nextTurn();
    },

    manualAdjustScore: (teamId: string, delta: number, reason?: string) =>
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

    setQuizTitle: (title: string) => set({ quizTitle: title }),
    setQuizDescription: (description: string) =>
      set({ quizDescription: description }),
    setQuizTimeLimit: (timeLimit: number | null) =>
      set({ quizTimeLimit: timeLimit }),
    setQuizTheme: (theme: QuizTheme) => set({ quizTheme: theme }),
    setQuizIsPublic: (isPublic: boolean) => set({ quizIsPublic: isPublic }),

    // Turn management actions
    setCurrentTurn: (teamId: string) => {
      set({ currentTurnTeamId: teamId, isInitialTurnSelection: false });
    },

    initializeTurn: () => {
      const teams = get().teams;
      if (!teams.length) return;

      // Pick random team for first turn
      const randomIndex = Math.floor(Math.random() * teams.length);
      const randomTeamId = teams[randomIndex].id;

      // Set initial turn selection flag to true for spinner animation
      set({ isInitialTurnSelection: true });

      // After animation (3 seconds), set the actual turn
      setTimeout(() => {
        set({ currentTurnTeamId: randomTeamId, isInitialTurnSelection: false });
      }, 3000);
    },

    nextTurn: () => {
      const teams = get().teams;
      const currentId = get().currentTurnTeamId;

      if (!teams.length) return;

      // If no current turn, initialize
      if (!currentId) {
        get().initializeTurn();
        return;
      }

      // Find next team in rotation
      const currentIndex = teams.findIndex((t) => t.id === currentId);
      const nextIndex = (currentIndex + 1) % teams.length;
      set({ currentTurnTeamId: teams[nextIndex].id });
    },
  };

  return {
    categories: initialGameData.map((category) => ({
      name: category.name,
      questions: category.questions.map((q: any) => ({
        points: q.points,
        question: q.question,
        answer: q.answer,
        imageUrl: q.imageUrl,
        isJoker: q.isJoker || false,
        jokerTask: q.jokerTask || "",
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
    currentTurnTeamId: null as string | null,
    isInitialTurnSelection: false,
    quizTitle: "Showdown Grid",
    quizDescription: "A Jeopardy-style quiz game.",
    quizTimeLimit: null as number | null,
    quizTheme: "classic" as QuizTheme,
    quizIsPublic: false,
    isLoading: true,
    isSaving: false,
    hasUnsavedChanges: false,
    activeQuizId: null as string | null,
    activeQuizOwnerId: null as string | null,
    quizzesList: [] as QuizMetadata[],
    currentRunStartTime: null as number | null,

    // Wrap all mutating actions
    setCategories: withUnsavedChanges(actions.setCategories, set),
    addCategory: withUnsavedChanges(actions.addCategory, set),
    removeCategory: withUnsavedChanges(actions.removeCategory, set),
    addTeam: withUnsavedChanges(actions.addTeam, set),
    removeTeam: withUnsavedChanges(actions.removeTeam, set),
    updateTeamName: withUnsavedChanges(actions.updateTeamName, set),
    updateTeamPlayers: withUnsavedChanges(actions.updateTeamPlayers, set),
    updateScore: withUnsavedChanges(actions.updateScore, set),
    markQuestionAsAnswered: withUnsavedChanges(
      actions.markQuestionAsAnswered,
      set
    ),
    resetGame: withUnsavedChanges(actions.resetGame, set),
    awardPositive: withUnsavedChanges(actions.awardPositive, set),
    awardNegative: withUnsavedChanges(actions.awardNegative, set),
    manualAdjustScore: withUnsavedChanges(actions.manualAdjustScore, set),
    undoLastAdjustment: withUnsavedChanges(actions.undoLastAdjustment, set),
    setQuizTitle: withUnsavedChanges(actions.setQuizTitle, set),
    setQuizDescription: withUnsavedChanges(actions.setQuizDescription, set),
    setQuizTimeLimit: withUnsavedChanges(actions.setQuizTimeLimit, set),
    setQuizTheme: withUnsavedChanges(actions.setQuizTheme, set),
    setQuizIsPublic: withUnsavedChanges(actions.setQuizIsPublic, set),

    // Non-mutating actions
    setLastQuestion: actions.setLastQuestion,
    setQuestionOpen: actions.setQuestionOpen,
    endRound: actions.endRound,
    setCurrentTurn: actions.setCurrentTurn,
    initializeTurn: actions.initializeTurn,
    nextTurn: actions.nextTurn,

    loadQuizFromDB: async () => {
      set({ isLoading: true });
      try {
        const response = await fetch("/api/quiz");

        if (response.status === 404) {
          console.log("No saved quiz found for user, using initial state.");
          set({ isLoading: false, hasUnsavedChanges: false });
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to load quiz: ${response.status}`);
        }

        const quizData = await response.json();

        // Extract quiz metadata
        const {
          quizId,
          quizOwnerId,
          quizTitle,
          quizDescription,
          quizTimeLimit,
          quizTheme,
          quizIsPublic,
          ...restData
        } = quizData.data;

        // Overwrite state with data from database
        set({
          ...restData,
          quizTitle,
          quizDescription,
          quizTimeLimit: quizTimeLimit || null,
          quizTheme: quizTheme || "classic",
          quizIsPublic: quizIsPublic || false,
          activeQuizId: quizId,
          activeQuizOwnerId: quizOwnerId,
          isLoading: false,
          hasUnsavedChanges: false,
        });
      } catch (error: any) {
        console.error("Failed to load quiz from DB:", error);
        set({
          isLoading: false,
          hasUnsavedChanges: false,
        });
      }
    },

    loadQuizzesList: async () => {
      try {
        const response = await fetch("/api/quizzes");

        if (!response.ok) {
          throw new Error("Failed to load quizzes list");
        }

        const { quizzes } = await response.json();
        set({ quizzesList: quizzes });
      } catch (error) {
        console.error("Failed to load quizzes list:", error);
      }
    },

    switchQuiz: async (quizId: string) => {
      try {
        set({ isLoading: true });

        // Activate the selected quiz
        const activateResponse = await fetch(
          `/api/quizzes/${quizId}/activate`,
          {
            method: "POST",
          }
        );

        if (!activateResponse.ok) {
          throw new Error("Failed to activate quiz");
        }

        // Reload the active quiz
        await get().loadQuizFromDB();

        // Reload the quizzes list to update active status
        await get().loadQuizzesList();
      } catch (error) {
        console.error("Failed to switch quiz:", error);
        set({ isLoading: false });
      }
    },

    loadPublicQuiz: async (quizId: string) => {
      try {
        set({ isLoading: true });

        // Load the quiz without activating it
        const response = await fetch(`/api/quizzes/${quizId}/load`);

        if (!response.ok) {
          throw new Error("Failed to load quiz");
        }

        const quizData = await response.json();

        // Extract quiz metadata
        const {
          quizId: id,
          quizOwnerId,
          quizTitle,
          quizDescription,
          quizTimeLimit,
          quizTheme,
          quizIsPublic,
          ...restData
        } = quizData.data;

        // Load quiz data without making it "active" in the database
        set({
          ...restData,
          quizTitle,
          quizDescription,
          quizTimeLimit: quizTimeLimit || null,
          quizTheme: quizTheme || "classic",
          quizIsPublic: quizIsPublic || false,
          activeQuizId: id,
          activeQuizOwnerId: quizOwnerId,
          isLoading: false,
          hasUnsavedChanges: false,
        });
      } catch (error) {
        console.error("Failed to load public quiz:", error);
        set({ isLoading: false });
      }
    },

    createNewQuiz: async (title: string, description?: string) => {
      try {
        const response = await fetch("/api/quizzes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            setAsActive: false, // Don't auto-switch to new quiz
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create quiz");
        }

        // Reload quizzes list
        await get().loadQuizzesList();
      } catch (error) {
        console.error("Failed to create quiz:", error);
        throw error;
      }
    },

    deleteQuiz: async (quizId: string) => {
      try {
        const response = await fetch(`/api/quizzes/${quizId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete quiz");
        }

        // If we deleted the active quiz, load another one
        if (get().activeQuizId === quizId) {
          await get().loadQuizFromDB();
        }

        // Reload quizzes list
        await get().loadQuizzesList();
      } catch (error) {
        console.error("Failed to delete quiz:", error);
        throw error;
      }
    },

    saveQuizToDB: async () => {
      // Don't save if nothing has changed
      if (!get().hasUnsavedChanges && !get().isSaving) return;

      set({ isSaving: true });
      try {
        const {
          categories,
          teams,
          quizTitle,
          quizDescription,
          quizTimeLimit,
          quizTheme,
          quizIsPublic,
          adjustmentLog,
        } = get();

        const quizStateToSave = {
          categories,
          teams,
          quizTitle,
          quizDescription,
          quizTimeLimit,
          quizTheme,
          quizIsPublic,
          adjustmentLog,
        };

        const response = await fetch("/api/quiz", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: quizStateToSave }),
        });

        if (!response.ok) {
          throw new Error("Failed to save quiz");
        }

        set({ isSaving: false, hasUnsavedChanges: false });
      } catch (error) {
        console.error("Failed to save quiz to DB:", error);
        set({ isSaving: false });
      }
    },

    setRunStartTime: (time: number | null) => {
      set({ currentRunStartTime: time });
    },

    saveQuizRun: async () => {
      const state = get();

      if (!state.currentRunStartTime || !state.activeQuizId) {
        console.error("No active run to save - missing start time or quiz ID");
        return;
      }

      const endTime = Date.now();

      try {
        const response = await fetch("/api/quiz-runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quizId: state.activeQuizId,
            startedAt: new Date(state.currentRunStartTime).toISOString(),
            endedAt: new Date(endTime).toISOString(),
            finalState: {
              categories: state.categories,
              teams: state.teams,
              adjustmentLog: state.adjustmentLog,
            },
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save quiz run");
        }

        const { run } = await response.json();
        console.log("Quiz run saved successfully:", run);

        // Reset run timer
        set({ currentRunStartTime: null });
      } catch (error) {
        console.error("Error saving quiz run:", error);
        throw error;
      }
    },
  };
});
