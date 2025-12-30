import { create } from "zustand";
import type {
  GameState,
  Category,
  Team,
  Question,
  LastQuestion,
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
    jokerTimer: 10,
    answered: false,
  }));

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Module-level variable for rate limiting session saves (max 1 per second)
let lastSessionSaveTime = 0;

// Helper function to mark changes as "dirty"
const withUnsavedChanges = <T extends (...args: never[]) => unknown>(
  fn: T,
  set: (partial: Partial<GameState>) => void
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

    setLastQuestion: (question: LastQuestion | null) => {
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
      const state = get();

      // Complete active session if one exists before resetting
      if (state.activeRunId) {
        get()
          .completeSession(state.activeRunId)
          .catch((error) => {
            console.error("Failed to complete session on reset:", error);
          });
      }

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
        currentTurnTeamId: null,
        isInitialTurnSelection: false,
        activeRunId: null,
        currentRunStartTime: null,
      });
    },

    awardPositive: (teamId: string, customPoints?: number) => {
      const { lastQuestion, round, adjustmentLog, teams } = get();
      if (!lastQuestion || round.positiveTeamId) return;

      const pointsToAward = customPoints ?? lastQuestion.points;
      const team = teams.find((t) => t.id === teamId);

      get().markQuestionAsAnswered(
        lastQuestion.categoryName,
        lastQuestion.questionIndex
      );

      // Log custom scoring if points differ from question value
      let newAdjustmentLog = adjustmentLog;
      if (customPoints !== undefined && customPoints !== lastQuestion.points && team) {
        const entry: AdjustmentEntry = {
          id: genId(),
          teamId,
          teamNameSnapshot: team.name,
          delta: customPoints,
          reason: `Custom scoring på ${lastQuestion.categoryName} (${lastQuestion.points} poeng)`,
          createdAt: Date.now(),
          type: "custom_scoring",
        };
        newAdjustmentLog = [entry, ...adjustmentLog];
      }

      set((state) => {
        return {
          teams: state.teams.map((t) =>
            t.id === teamId ? { ...t, score: t.score + pointsToAward } : t
          ),
          round: { ...state.round, positiveTeamId: teamId },
          adjustmentLog: newAdjustmentLog,
        };
      });
    },

    awardNegative: (teamId: string, customPoints?: number) => {
      const { lastQuestion, round, adjustmentLog, teams } = get();
      if (
        !lastQuestion ||
        round.positiveTeamId ||
        round.negativeAwardedTo.includes(teamId)
      )
        return;

      const defaultPenalty = -Math.round(lastQuestion.points * 0.5);
      const penalty = customPoints ?? defaultPenalty;
      const team = teams.find((t) => t.id === teamId);

      // Log custom scoring if points differ from default penalty
      let newAdjustmentLog = adjustmentLog;
      if (customPoints !== undefined && customPoints !== defaultPenalty && team) {
        const entry: AdjustmentEntry = {
          id: genId(),
          teamId,
          teamNameSnapshot: team.name,
          delta: customPoints,
          reason: `Custom penalty på ${lastQuestion.categoryName} (standard: ${defaultPenalty})`,
          createdAt: Date.now(),
          type: "custom_scoring",
        };
        newAdjustmentLog = [entry, ...adjustmentLog];
      }

      set((state) => ({
        teams: state.teams.map((t) =>
          t.id === teamId ? { ...t, score: t.score + penalty } : t
        ),
        round: {
          ...state.round,
          negativeAwardedTo: [...state.round.negativeAwardedTo, teamId],
        },
        adjustmentLog: newAdjustmentLog,
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

    skipQuestion: () => {
      const { lastQuestion } = get();
      if (!lastQuestion) return;

      // Mark question as answered without awarding any points
      get().markQuestionAsAnswered(
        lastQuestion.categoryName,
        lastQuestion.questionIndex
      );

      set({
        lastQuestion: null,
        isQuestionOpen: false,
        round: initialRoundState(),
      });

      // Move to next team's turn
      get().nextTurn();
    },

    toggleQuestionAnswered: (categoryName: string, questionIndex: number, answered: boolean) =>
      set((state) => ({
        categories: state.categories.map((cat) => {
          if (cat.name !== categoryName) return cat;
          const questions = [...cat.questions];
          const q = questions[questionIndex];
          if (q) questions[questionIndex] = { ...q, answered };
          return { ...cat, questions };
        }),
      })),

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
    setJokerTimeLimit: (timeLimit: number | null) =>
      set({ jokerTimeLimit: timeLimit }),
    setQuizTheme: (theme: QuizTheme) => set({ quizTheme: theme }),
    setQuizIsPublic: (isPublic: boolean) => set({ quizIsPublic: isPublic }),

    // Turn management actions
    setCurrentTurn: (teamId: string | null) => {
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
      questions: category.questions.map((q): Question => ({
        points: q.points,
        question: q.question,
        answer: q.answer,
        imageUrl: q.imageUrl,
        isJoker: ('isJoker' in q && typeof q.isJoker === 'boolean') ? q.isJoker : false,
        jokerTask: ('jokerTask' in q && typeof q.jokerTask === 'string') ? q.jokerTask : "",
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
    isPlayingPublicQuiz: false,
    quizTitle: "Showdown Grid",
    quizDescription: "A Jeopardy-style quiz game.",
    quizTimeLimit: null as number | null,
    jokerTimeLimit: 10 as number | null,
    quizTheme: "classic" as QuizTheme,
    quizIsPublic: false,
    isLoading: true,
    isSaving: false,
    hasUnsavedChanges: false,
    activeQuizId: null as string | null,
    activeQuizOwnerId: null as string | null,
    currentRunStartTime: null as number | null,
    activeRunId: null as string | null,

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
    skipQuestion: withUnsavedChanges(actions.skipQuestion, set),
    toggleQuestionAnswered: withUnsavedChanges(actions.toggleQuestionAnswered, set),
    manualAdjustScore: withUnsavedChanges(actions.manualAdjustScore, set),
    undoLastAdjustment: withUnsavedChanges(actions.undoLastAdjustment, set),
    setQuizTitle: withUnsavedChanges(actions.setQuizTitle, set),
    setQuizDescription: withUnsavedChanges(actions.setQuizDescription, set),
    setQuizTimeLimit: withUnsavedChanges(actions.setQuizTimeLimit, set),
    setJokerTimeLimit: withUnsavedChanges(actions.setJokerTimeLimit, set),
    setQuizTheme: withUnsavedChanges(actions.setQuizTheme, set),
    setQuizIsPublic: withUnsavedChanges(actions.setQuizIsPublic, set),

    // Non-mutating actions
    setLastQuestion: actions.setLastQuestion,
    setQuestionOpen: actions.setQuestionOpen,
    endRound: actions.endRound,
    setCurrentTurn: actions.setCurrentTurn,
    initializeTurn: actions.initializeTurn,
    nextTurn: actions.nextTurn,

    saveQuizToDB: async () => {
      // Don't save if nothing has changed or if playing a public quiz
      if (!get().hasUnsavedChanges && !get().isSaving) return;
      if (get().isPlayingPublicQuiz) {
        console.log("Skipping save - playing public quiz (session-only)");
        return;
      }

      set({ isSaving: true });
      try {
        const {
          categories,
          teams,
          quizTitle,
          quizDescription,
          quizTimeLimit,
          jokerTimeLimit,
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
          jokerTimeLimit,
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
      // Legacy method - now uses completeSession
      const state = get();
      if (state.activeRunId) {
        await get().completeSession(state.activeRunId);
      } else {
        console.warn("No active session to complete");
      }
    },

    startSession: async () => {
      const state = get();
      if (!state.activeQuizId) {
        console.error("Cannot start session - no active quiz ID");
        return null;
      }

      // Check if there's already an active session for this quiz
      try {
        const checkResponse = await fetch(
          `/api/quiz-runs/active?quizId=${state.activeQuizId}`
        );
        if (checkResponse.ok) {
          const { run } = await checkResponse.json();
          console.log("Found existing active session:", run.id);
          set({
            activeRunId: run.id,
            currentRunStartTime: new Date(run.started_at).getTime(),
          });
          return run.id;
        }
      } catch (error) {
        console.error("Error checking for active session:", error);
      }

      // Create new session
      const startTime = Date.now();
      try {
        const response = await fetch("/api/quiz-runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quizId: state.activeQuizId,
            startedAt: new Date(startTime).toISOString(),
            // No endedAt - this is a live session
            finalState: {
              categories: state.categories,
              teams: state.teams,
              adjustmentLog: state.adjustmentLog,
            },
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to start session");
        }

        const { run } = await response.json();
        console.log("Session started:", run.id);
        set({
          activeRunId: run.id,
          currentRunStartTime: startTime,
        });
        return run.id;
      } catch (error) {
        console.error("Error starting session:", error);
        return null;
      }
    },

    saveSession: async () => {
      const state = get();
      if (!state.activeRunId) {
        return; // No active session to save
      }

      // Rate limiting: only save once per second
      const now = Date.now();
      if (now - lastSessionSaveTime < 1000) {
        return; // Skip if less than 1 second since last save
      }

      try {
        const response = await fetch(`/api/quiz-runs/${state.activeRunId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            finalState: {
              categories: state.categories,
              teams: state.teams,
              adjustmentLog: state.adjustmentLog,
            },
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save session");
        }

        // Update last save time
        lastSessionSaveTime = now;
      } catch (error) {
        console.error("Error saving session:", error);
        // Don't throw - auto-save failures shouldn't break the app
      }
    },

    restoreActiveSession: async (quizId: string) => {
      try {
        const response = await fetch(`/api/quiz-runs/active?quizId=${quizId}`);
        if (response.status === 404) {
          // No active session found - this is fine
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to restore active session");
        }

        const { run } = await response.json();
        const finalState = run.final_state;

        // Restore state from session
        set({
          activeRunId: run.id,
          currentRunStartTime: new Date(run.started_at).getTime(),
          categories: finalState.categories || get().categories,
          teams: finalState.teams || get().teams,
          adjustmentLog: finalState.adjustmentLog || [],
          hasUnsavedChanges: false,
        });

        console.log("Active session restored:", run.id);
      } catch (error) {
        console.error("Error restoring active session:", error);
      }
    },

    completeSession: async (runId: string, quizId?: string) => {
      const state = get();
      if (!state.currentRunStartTime) {
        console.error("Cannot complete session - no start time");
        return;
      }

      // Use provided quizId or fall back to activeQuizId from state
      const sessionQuizId = quizId || state.activeQuizId;
      if (!sessionQuizId) {
        console.error("Cannot complete session - no quiz ID");
        return;
      }

      try {
        const response = await fetch(`/api/quiz-runs/${runId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            finalState: {
              categories: state.categories,
              teams: state.teams,
              adjustmentLog: state.adjustmentLog,
            },
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to complete session");
        }

        const { run } = await response.json();
        console.log("Session completed:", run.id);

        // Reset session tracking
        set({
          activeRunId: null,
          currentRunStartTime: null,
        });
      } catch (error) {
        console.error("Error completing session:", error);
        throw error;
      }
    },
  };
});
