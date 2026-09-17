import { create } from "zustand";
import type {
  GameState,
  Category,
  Question,
  LastQuestion,
  AdjustmentEntry,
  QuizTheme,
  LoadQuizInput,
} from "./types";
import {
  defaultTeams,
  emptyCategory,
  emptyQuestion,
  extractLiveState,
  extractTemplate,
  liveStateFromRunState,
  mergeLiveIntoTemplate,
  starterCategories,
  DEFAULT_POINTS,
} from "./quiz-template";
import {
  clearSnapshot,
  readSnapshot,
  rememberPublicPlay,
  snapshotIsAhead,
  writeSnapshot,
} from "./live-snapshot";

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

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Live state is written at most this often; the last write always lands. */
const SESSION_SAVE_INTERVAL_MS = 1000;
let lastSessionSaveTime = 0;
let pendingSessionSave: ReturnType<typeof setTimeout> | null = null;

/**
 * One session-create in flight at a time. Without this, two effects racing on
 * the first opened question each saw "no active session" and inserted one,
 * leaving an orphan run that a later restore could pick instead of the real one.
 */
let startSessionInFlight: Promise<string | null> | null = null;

/**
 * Save status lives in the store, including the timed fade from "Lagret" back
 * to idle. Keeping the transition here rather than in the indicator means the
 * component stays a pure render of state.
 */
let savedFadeTimer: ReturnType<typeof setTimeout> | null = null;

export function reportSaving(): void {
  if (savedFadeTimer) clearTimeout(savedFadeTimer);
  useGameStore.setState({
    saveStatus: "saving",
    isSaving: true,
    saveError: null,
  });
}

export function reportSaved(): void {
  useGameStore.setState({
    saveStatus: "saved",
    isSaving: false,
    hasUnsavedChanges: false,
    lastSavedAt: Date.now(),
    saveError: null,
  });
  if (savedFadeTimer) clearTimeout(savedFadeTimer);
  savedFadeTimer = setTimeout(() => {
    savedFadeTimer = null;
    if (useGameStore.getState().saveStatus === "saved") {
      useGameStore.setState({ saveStatus: "idle" });
    }
  }, 2500);
}

export function reportSaveError(message: string): void {
  if (savedFadeTimer) clearTimeout(savedFadeTimer);
  useGameStore.setState({
    saveStatus: "error",
    isSaving: false,
    saveError: message,
  });
}

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
  /** Mirrors the live state to localStorage after every scoring action. */
  const snapshotLiveState = () => {
    const state = get();
    if (!state.activeQuizId) return;
    writeSnapshot(
      state.activeQuizId,
      extractLiveState({
        categories: state.categories,
        teams: state.teams,
        adjustmentLog: state.adjustmentLog,
        currentTurnTeamId: state.currentTurnTeamId,
      }),
      state.activeRunId
    );
  };

  const actions = {
    setCategories: (categories: Category[]) => set({ categories }),

    addCategory: () =>
      set((state) => ({
        categories: [
          ...state.categories,
          emptyCategory(`Kategori ${state.categories.length + 1}`),
        ],
      })),

    removeCategory: (index: number) =>
      set((state) => ({
        categories: state.categories.filter((_, i) => i !== index),
      })),

    renameCategory: (categoryIndex: number, name: string) =>
      set((state) => ({
        categories: state.categories.map((cat, i) =>
          i === categoryIndex ? { ...cat, name } : cat
        ),
      })),

    duplicateCategory: (categoryIndex: number) =>
      set((state) => {
        const source = state.categories[categoryIndex];
        if (!source) return state;
        const copy: Category = {
          name: `${source.name} (kopi)`,
          questions: source.questions.map((q) => ({ ...q, answered: false })),
        };
        const next = [...state.categories];
        next.splice(categoryIndex + 1, 0, copy);
        return { categories: next };
      }),

    moveCategory: (categoryIndex: number, direction: -1 | 1) =>
      set((state) => {
        const target = categoryIndex + direction;
        if (target < 0 || target >= state.categories.length) return state;
        const next = [...state.categories];
        [next[categoryIndex], next[target]] = [next[target], next[categoryIndex]];
        return { categories: next };
      }),

    addQuestionToCategory: (categoryIndex: number) =>
      set((state) => ({
        categories: state.categories.map((cat, i) => {
          if (i !== categoryIndex) return cat;
          const last = cat.questions[cat.questions.length - 1];
          const step =
            cat.questions.length >= 2
              ? cat.questions[cat.questions.length - 1].points -
                cat.questions[cat.questions.length - 2].points
              : 100;
          const nextPoints = last
            ? Math.max(0, last.points + (step > 0 ? step : 100))
            : DEFAULT_POINTS[0];
          return { ...cat, questions: [...cat.questions, emptyQuestion(nextPoints)] };
        }),
      })),

    removeQuestionFromCategory: (categoryIndex: number, questionIndex: number) =>
      set((state) => ({
        categories: state.categories.map((cat, i) =>
          i === categoryIndex
            ? {
                ...cat,
                questions: cat.questions.filter((_, qi) => qi !== questionIndex),
              }
            : cat
        ),
      })),

    moveQuestion: (
      categoryIndex: number,
      questionIndex: number,
      direction: -1 | 1
    ) =>
      set((state) => {
        const category = state.categories[categoryIndex];
        if (!category) return state;
        const target = questionIndex + direction;
        if (target < 0 || target >= category.questions.length) return state;
        const questions = [...category.questions];
        [questions[questionIndex], questions[target]] = [
          questions[target],
          questions[questionIndex],
        ];
        return {
          categories: state.categories.map((cat, i) =>
            i === categoryIndex ? { ...cat, questions } : cat
          ),
        };
      }),

    updateQuestion: (
      categoryIndex: number,
      questionIndex: number,
      patch: Partial<Question>
    ) =>
      set((state) => ({
        categories: state.categories.map((cat, i) => {
          if (i !== categoryIndex) return cat;
          return {
            ...cat,
            questions: cat.questions.map((q, qi) =>
              qi === questionIndex ? { ...q, ...patch } : q
            ),
          };
        }),
      })),

    addTeam: () =>
      set((state) => ({
        teams: [
          ...state.teams,
          {
            id: genId(),
            name: `Lag ${state.teams.length + 1}`,
            score: 0,
            players: [],
          },
        ],
      })),

    removeTeam: (id: string) =>
      set((state) => ({
        teams: state.teams.filter((t) => t.id !== id),
        currentTurnTeamId:
          state.currentTurnTeamId === id ? null : state.currentTurnTeamId,
      })),

    updateTeamName: (id: string, name: string) =>
      set((state) => ({
        teams: state.teams.map((t) => (t.id === id ? { ...t, name } : t)),
      })),

    updateTeamPlayers: (id: string, players: string[]) =>
      set((state) => ({
        teams: state.teams.map((t) => (t.id === id ? { ...t, players } : t)),
      })),

    setLastQuestion: (question: LastQuestion | null) => {
      set({
        lastQuestion: question,
        isQuestionOpen: !!question,
        round: question
          ? { ...initialRoundState(), active: true }
          : initialRoundState(),
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

      if (state.activeRunId) {
        get()
          .completeSession(state.activeRunId)
          .catch((error) => {
            console.error("Failed to complete session on reset:", error);
          });
      }
      if (state.activeQuizId) clearSnapshot(state.activeQuizId);

      set({
        categories: state.categories.map((cat) => ({
          ...cat,
          questions: cat.questions.map((q) => ({ ...q, answered: false })),
        })),
        teams: state.teams.map((t) => ({ ...t, score: 0 })),
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

      let newAdjustmentLog = adjustmentLog;
      if (
        customPoints !== undefined &&
        customPoints !== lastQuestion.points &&
        team
      ) {
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

      set((state) => ({
        teams: state.teams.map((t) =>
          t.id === teamId ? { ...t, score: t.score + pointsToAward } : t
        ),
        round: { ...state.round, positiveTeamId: teamId },
        adjustmentLog: newAdjustmentLog,
      }));
      snapshotLiveState();
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

      let newAdjustmentLog = adjustmentLog;
      if (
        customPoints !== undefined &&
        customPoints !== defaultPenalty &&
        team
      ) {
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
      snapshotLiveState();
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
      get().nextTurn();
      snapshotLiveState();
    },

    skipQuestion: () => {
      const { lastQuestion } = get();
      if (!lastQuestion) return;

      get().markQuestionAsAnswered(
        lastQuestion.categoryName,
        lastQuestion.questionIndex
      );

      set({
        lastQuestion: null,
        isQuestionOpen: false,
        round: initialRoundState(),
      });
      get().nextTurn();
      snapshotLiveState();
    },

    toggleQuestionAnswered: (
      categoryName: string,
      questionIndex: number,
      answered: boolean
    ) => {
      set((state) => ({
        categories: state.categories.map((cat) => {
          if (cat.name !== categoryName) return cat;
          const questions = [...cat.questions];
          const q = questions[questionIndex];
          if (q) questions[questionIndex] = { ...q, answered };
          return { ...cat, questions };
        }),
      }));
      snapshotLiveState();
    },

    manualAdjustScore: (teamId: string, delta: number, reason?: string) => {
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
      });
      snapshotLiveState();
    },

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
      snapshotLiveState();
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

    setCurrentTurn: (teamId: string | null) => {
      set({ currentTurnTeamId: teamId, isInitialTurnSelection: false });
      snapshotLiveState();
    },

    initializeTurn: () => {
      const teams = get().teams;
      if (!teams.length) return;

      const randomTeamId = teams[Math.floor(Math.random() * teams.length)].id;
      set({ isInitialTurnSelection: true });

      setTimeout(() => {
        // Teams can be edited while the wheel spins; drop the pick if the team
        // is gone rather than pointing the turn at a team that no longer exists.
        const stillThere = get().teams.some((t) => t.id === randomTeamId);
        set({
          currentTurnTeamId: stillThere ? randomTeamId : get().teams[0]?.id ?? null,
          isInitialTurnSelection: false,
        });
        snapshotLiveState();
      }, 3000);
    },

    nextTurn: () => {
      const teams = get().teams;
      const currentId = get().currentTurnTeamId;

      if (!teams.length) return;
      if (!currentId) {
        get().initializeTurn();
        return;
      }

      const currentIndex = teams.findIndex((t) => t.id === currentId);
      const nextIndex = (currentIndex + 1) % teams.length;
      set({ currentTurnTeamId: teams[nextIndex].id });
    },
  };

  return {
    // A new quiz starts from a blank board, not from the old English demo data:
    // a board already full of someone else's questions is harder to clear than
    // to fill.
    categories: starterCategories(),
    teams: defaultTeams(),
    lastQuestion: null,
    isQuestionOpen: false,
    round: initialRoundState(),
    adjustmentLog: [],
    currentTurnTeamId: null as string | null,
    isInitialTurnSelection: false,
    isPlayingPublicQuiz: false,
    quizTitle: "",
    quizDescription: "",
    quizTimeLimit: null as number | null,
    jokerTimeLimit: 10 as number | null,
    quizTheme: "classic" as QuizTheme,
    quizIsPublic: false,
    isLoading: true,
    isHydrated: false,
    isSaving: false,
    saveStatus: "idle",
    saveError: null as string | null,
    lastSavedAt: null as number | null,
    hasUnsavedChanges: false,
    activeQuizId: null as string | null,
    activeQuizOwnerId: null as string | null,
    currentUserId: null as string | null,
    currentUserEmail: null as string | null,
    isAnonymousUser: false,
    currentRunStartTime: null as number | null,
    activeRunId: null as string | null,

    setCategories: withUnsavedChanges(actions.setCategories, set),
    addCategory: withUnsavedChanges(actions.addCategory, set),
    removeCategory: withUnsavedChanges(actions.removeCategory, set),
    renameCategory: withUnsavedChanges(actions.renameCategory, set),
    duplicateCategory: withUnsavedChanges(actions.duplicateCategory, set),
    moveCategory: withUnsavedChanges(actions.moveCategory, set),
    addQuestionToCategory: withUnsavedChanges(actions.addQuestionToCategory, set),
    removeQuestionFromCategory: withUnsavedChanges(
      actions.removeQuestionFromCategory,
      set
    ),
    moveQuestion: withUnsavedChanges(actions.moveQuestion, set),
    updateQuestion: withUnsavedChanges(actions.updateQuestion, set),
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
    skipQuestion: withUnsavedChanges(actions.skipQuestion, set),
    toggleQuestionAnswered: withUnsavedChanges(
      actions.toggleQuestionAnswered,
      set
    ),
    manualAdjustScore: withUnsavedChanges(actions.manualAdjustScore, set),
    undoLastAdjustment: withUnsavedChanges(actions.undoLastAdjustment, set),
    setQuizTitle: withUnsavedChanges(actions.setQuizTitle, set),
    setQuizDescription: withUnsavedChanges(actions.setQuizDescription, set),
    setQuizTimeLimit: withUnsavedChanges(actions.setQuizTimeLimit, set),
    setJokerTimeLimit: withUnsavedChanges(actions.setJokerTimeLimit, set),
    setQuizTheme: withUnsavedChanges(actions.setQuizTheme, set),
    setQuizIsPublic: withUnsavedChanges(actions.setQuizIsPublic, set),

    setLastQuestion: actions.setLastQuestion,
    setQuestionOpen: actions.setQuestionOpen,
    endRound: actions.endRound,
    setCurrentTurn: actions.setCurrentTurn,
    initializeTurn: actions.initializeTurn,
    nextTurn: actions.nextTurn,

    setHydrated: (hydrated: boolean) =>
      set({ isHydrated: hydrated, isLoading: !hydrated }),

    setCurrentUser: ({
      id,
      email = null,
      isAnonymous = false,
    }: {
      id: string | null;
      email?: string | null;
      isAnonymous?: boolean;
    }) =>
      set({
        currentUserId: id,
        currentUserEmail: email,
        isAnonymousUser: isAnonymous,
      }),

    /**
     * Signing out used to call resetGame(), which clears scores but keeps the
     * quiz. The store survives client-side navigation, so the next guest — or
     * the real account you just signed in to — opened straight into the previous
     * user's quiz, and useQuizBootstrap short-circuited on the stale
     * activeQuizId instead of loading the right one.
     */
    resetForNewUser: () => {
      const { activeQuizId } = get();
      if (activeQuizId) clearSnapshot(activeQuizId);
      rememberPublicPlay(null);

      set({
        categories: starterCategories(),
        teams: defaultTeams(),
        lastQuestion: null,
        isQuestionOpen: false,
        round: initialRoundState(),
        adjustmentLog: [],
        currentTurnTeamId: null,
        isInitialTurnSelection: false,
        isPlayingPublicQuiz: false,
        quizTitle: "",
        quizDescription: "",
        quizTimeLimit: null,
        jokerTimeLimit: 10,
        quizTheme: "classic",
        quizIsPublic: false,
        activeQuizId: null,
        activeQuizOwnerId: null,
        currentUserId: null,
        currentUserEmail: null,
        isAnonymousUser: false,
        activeRunId: null,
        currentRunStartTime: null,
        isHydrated: false,
        isLoading: true,
        hasUnsavedChanges: false,
        saveStatus: "idle",
        saveError: null,
        lastSavedAt: null,
      });
    },

    canEditActiveQuiz: () => {
      const { currentUserId, activeQuizOwnerId, isPlayingPublicQuiz } = get();
      if (isPlayingPublicQuiz) return false;
      if (!currentUserId || !activeQuizOwnerId) return false;
      return currentUserId === activeQuizOwnerId;
    },

    loadQuiz: ({
      template,
      live,
      quizId,
      quizOwnerId,
      runId = null,
      runStartedAt = null,
      isPublicPlay = false,
    }: LoadQuizInput) => {
      const merged = mergeLiveIntoTemplate(template, live ?? null);
      set({
        categories: merged.categories,
        teams: merged.teams,
        adjustmentLog: merged.adjustmentLog,
        currentTurnTeamId: merged.currentTurnTeamId,
        quizTitle: template.quizTitle,
        quizDescription: template.quizDescription,
        quizTimeLimit: template.quizTimeLimit,
        jokerTimeLimit: template.jokerTimeLimit,
        quizTheme: template.quizTheme,
        quizIsPublic: template.quizIsPublic,
        activeQuizId: quizId,
        activeQuizOwnerId: quizOwnerId,
        activeRunId: runId,
        currentRunStartTime: runStartedAt,
        isPlayingPublicQuiz: isPublicPlay,
        lastQuestion: null,
        isQuestionOpen: false,
        round: initialRoundState(),
        isInitialTurnSelection: false,
        hasUnsavedChanges: false,
        saveStatus: isPublicPlay ? "readonly" : "idle",
        saveError: null,
        isHydrated: true,
        isLoading: false,
      });
    },

    /** Writes the TEMPLATE only. Scores and answered questions never go here. */
    saveQuizToDB: async () => {
      const state = get();
      if (!state.canEditActiveQuiz() || !state.activeQuizId) {
        set({ saveStatus: state.isPlayingPublicQuiz ? "readonly" : "idle" });
        return;
      }

      reportSaving();
      try {
        const template = extractTemplate(state);
        const response = await fetch(`/api/quizzes/${state.activeQuizId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: template.quizTitle,
            description: template.quizDescription,
            timeLimit: template.quizTimeLimit,
            theme: template.quizTheme,
            isPublic: template.quizIsPublic,
            quizData: {
              categories: template.categories,
              teams: template.teams,
              jokerTimeLimit: template.jokerTimeLimit,
            },
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || `Lagring feilet (${response.status})`);
        }

        reportSaved();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Ukjent lagringsfeil";
        console.error("Failed to save quiz template:", error);
        reportSaveError(message);
      }
    },

    setRunStartTime: (time: number | null) => {
      set({ currentRunStartTime: time });
    },

    startSession: async () => {
      const state = get();
      if (!state.activeQuizId) return null;
      if (state.activeRunId) return state.activeRunId;
      if (startSessionInFlight) return startSessionInFlight;

      const quizId = state.activeQuizId;
      startSessionInFlight = (async () => {
        try {
          const response = await fetch("/api/quiz-runs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quizId,
              startedAt: new Date().toISOString(),
              finalState: extractLiveState({
                categories: get().categories,
                teams: get().teams,
                adjustmentLog: get().adjustmentLog,
                currentTurnTeamId: get().currentTurnTeamId,
              }),
            }),
          });

          if (!response.ok) {
            throw new Error(`Kunne ikke starte økt (${response.status})`);
          }

          const { run } = await response.json();
          set({
            activeRunId: run.id,
            currentRunStartTime: new Date(run.started_at).getTime(),
          });
          return run.id as string;
        } catch (error) {
          console.error("Error starting session:", error);
          return null;
        } finally {
          startSessionInFlight = null;
        }
      })();

      return startSessionInFlight;
    },

    saveSession: async () => {
      const state = get();
      if (!state.activeRunId) return;

      const now = Date.now();
      const elapsed = now - lastSessionSaveTime;
      if (elapsed < SESSION_SAVE_INTERVAL_MS) {
        // Schedule the write instead of dropping it. Dropping is what made the
        // last action of a fast sequence never reach the server.
        if (!pendingSessionSave) {
          pendingSessionSave = setTimeout(() => {
            pendingSessionSave = null;
            void get().flushSession();
          }, SESSION_SAVE_INTERVAL_MS - elapsed);
        }
        return;
      }

      await get().flushSession();
    },

    flushSession: async () => {
      const state = get();
      if (!state.activeRunId) return;
      if (pendingSessionSave) {
        clearTimeout(pendingSessionSave);
        pendingSessionSave = null;
      }

      lastSessionSaveTime = Date.now();
      const live = extractLiveState({
        categories: state.categories,
        teams: state.teams,
        adjustmentLog: state.adjustmentLog,
        currentTurnTeamId: state.currentTurnTeamId,
      });

      if (state.activeQuizId) {
        writeSnapshot(state.activeQuizId, live, state.activeRunId);
      }

      try {
        const response = await fetch(`/api/quiz-runs/${state.activeRunId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ finalState: live }),
        });
        if (!response.ok) throw new Error(`Status ${response.status}`);
      } catch (error) {
        // The local snapshot above already holds this state, so the game keeps
        // going and the next successful write catches up.
        console.error("Error saving session:", error);
      }
    },

    restoreActiveSession: async (quizId: string) => {
      try {
        const response = await fetch(`/api/quiz-runs/active?quizId=${quizId}`);
        if (!response.ok) throw new Error("Failed to restore active session");

        const { run } = await response.json();
        if (!run) {
          // No server session. A local snapshot can still hold a game that was
          // played before the first successful write.
          const snapshot = readSnapshot(quizId);
          if (snapshotIsAhead(snapshot, null) && snapshot) {
            applyLive(snapshot.live);
          }
          return;
        }

        const serverLive = liveStateFromRunState(run.final_state);
        const snapshot = readSnapshot(quizId);
        const live = snapshotIsAhead(snapshot, serverLive)
          ? snapshot!.live
          : serverLive;

        set({
          activeRunId: run.id,
          currentRunStartTime: new Date(run.started_at).getTime(),
        });
        if (live) applyLive(live);
      } catch (error) {
        console.error("Error restoring active session:", error);
      }

      function applyLive(live: NonNullable<ReturnType<typeof liveStateFromRunState>>) {
        const state = get();
        const merged = mergeLiveIntoTemplate(extractTemplate(state), live);
        set({
          categories: merged.categories,
          teams: merged.teams,
          adjustmentLog: merged.adjustmentLog,
          currentTurnTeamId: merged.currentTurnTeamId,
          hasUnsavedChanges: false,
        });
      }
    },

    completeSession: async (runId: string, quizId?: string) => {
      const state = get();
      const sessionQuizId = quizId || state.activeQuizId;
      if (!sessionQuizId) return;

      if (pendingSessionSave) {
        clearTimeout(pendingSessionSave);
        pendingSessionSave = null;
      }

      try {
        const response = await fetch(`/api/quiz-runs/${runId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            finalState: extractLiveState({
              categories: state.categories,
              teams: state.teams,
              adjustmentLog: state.adjustmentLog,
              currentTurnTeamId: state.currentTurnTeamId,
            }),
            teams: state.teams.map((t) => ({
              id: t.id,
              name: t.name,
              score: t.score,
            })),
            totalQuestions: state.categories.reduce(
              (sum, c) => sum + c.questions.length,
              0
            ),
            answeredQuestions: state.categories.reduce(
              (sum, c) => sum + c.questions.filter((q) => q.answered).length,
              0
            ),
          }),
        });

        if (!response.ok) {
          throw new Error(`Kunne ikke fullføre økten (${response.status})`);
        }

        clearSnapshot(sessionQuizId);
        // Finishing a session archives the night and hands the board back
        // clean. Leaving the scores on screen would mean the board disagrees
        // with what is stored the moment anyone reloads, since the live state
        // this came from no longer exists.
        set((state) => ({
          activeRunId: null,
          currentRunStartTime: null,
          categories: state.categories.map((cat) => ({
            ...cat,
            questions: cat.questions.map((q) => ({ ...q, answered: false })),
          })),
          teams: state.teams.map((t) => ({ ...t, score: 0 })),
          adjustmentLog: [],
          currentTurnTeamId: null,
          lastQuestion: null,
          isQuestionOpen: false,
        }));
      } catch (error) {
        console.error("Error completing session:", error);
        throw error;
      }
    },
  };
});

