import { create } from "zustand";
import type {
  GameState,
  Category,
  Question,
  LastQuestion,
  AdjustmentEntry,
  QuizTheme,
  QuizTemplate,
  LoadQuizInput,
  LiveGameState,
  RoundProgress,
  RoundStep,
  QuizRun,
  SaveTemplateOptions,
  Team,
  TurnRule,
} from "./types";
import { hasSessionProgress } from "./session-progress";
import {
  buildQueue,
  ladderAfterRemoval,
  nextRung,
  normalizePoints,
  sameCard,
  type CardRef,
  type QueueFilter,
} from "./card-status";
import {
  DEFAULT_TURN_RULE,
  defaultTeams,
  emptyCategory,
  emptyQuestion,
  extractLiveState,
  extractTemplate,
  liveStateFromRunState,
  mergeLiveIntoTemplate,
  newCategoryId,
  starterCategories,
  templateFingerprint,
  withCategoryIds,
} from "./quiz-template";
import {
  clearSnapshot,
  readSnapshot,
  rememberPublicPlay,
  snapshotIsAhead,
  isSnapshotUsable,
  writeSnapshot,
} from "./live-snapshot";
import { toast } from "@/hooks/use-toast";
import { getQueryClient } from "@/lib/query-client";
import { quizRunKeys } from "@/hooks/queries/useQuizRuns";

const initialRoundState = (): RoundProgress => ({
  active: false,
  positiveTeamId: null,
  negativeAwardedTo: [],
  entryIds: [],
  positiveEntryId: null,
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

/** The starting-team draw. A second draw replaces the first instead of both
 * landing, one after the other, after the spin had already shown a team. */
let drawTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Template saves run one at a time. Each save sends the updated_at the
 * previous one got back, so two in flight would reject each other, and
 * without the queue a slow early save could land after a later one.
 */
let templateSaveChain: Promise<unknown> = Promise.resolve();
let templateRetryTimer: ReturnType<typeof setTimeout> | null = null;
let templateRetryCount = 0;
const TEMPLATE_RETRY_LIMIT = 3;

export const SAVE_CONFLICT_MESSAGE =
  "Quizen er endret et annet sted. Det du har endret her siden sist, er ikke lagret.";

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

/** The PATCH body for a template. An empty title is left out: the server
 * rejects it, and with it every other change in the same save. */
function templateRequestBody(
  template: QuizTemplate,
  expectedUpdatedAt: string | null
): string {
  const title = template.quizTitle.trim();
  return JSON.stringify({
    ...(title ? { title } : {}),
    description: template.quizDescription,
    timeLimit: template.quizTimeLimit,
    theme: template.quizTheme,
    isPublic: template.quizIsPublic,
    quizData: {
      categories: template.categories,
      teams: template.teams,
      jokerTimeLimit: template.jokerTimeLimit,
      turnRule: template.turnRule,
    },
    expectedUpdatedAt,
  });
}

async function sendTemplate(
  quizId: string,
  body: string,
  keepalive: boolean
): Promise<Response> {
  const init: RequestInit = {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  };
  if (!keepalive) return fetch(`/api/quizzes/${quizId}`, init);
  try {
    return await fetch(`/api/quizzes/${quizId}`, { ...init, keepalive: true });
  } catch {
    // keepalive bodies are capped at 64 KB; a bigger board goes as a normal
    // request and may or may not finish before the page is gone.
    return fetch(`/api/quizzes/${quizId}`, init);
  }
}

function uniqueCategoryName(base: string, categories: Category[]): string {
  const taken = new Set(categories.map((c) => c.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

function nextFreeCategoryName(categories: Category[]): string {
  const taken = new Set(categories.map((c) => c.name));
  let n = categories.length + 1;
  while (taken.has(`Kategori ${n}`)) n += 1;
  return `Kategori ${n}`;
}

/** Moves the selection and the review queue along with a structural edit, so
 * the panel keeps showing the card it showed before. */
function remapCards(
  selected: CardRef | null,
  queue: GameState["queue"],
  map: (ref: CardRef) => CardRef | null
): Pick<GameState, "selectedCard" | "queue"> {
  const nextSelected = selected ? map(selected) : null;
  if (!queue) return { selectedCard: nextSelected, queue: null };
  const ids = queue.ids.flatMap((ref) => {
    const mapped = map(ref);
    return mapped ? [mapped] : [];
  });
  if (!ids.length) return { selectedCard: nextSelected, queue: null };
  const position = nextSelected
    ? Math.max(0, ids.findIndex((ref) => sameCard(ref, nextSelected)))
    : Math.min(queue.position, ids.length - 1);
  return { selectedCard: nextSelected, queue: { ...queue, ids, position } };
}

export const useGameStore = create<GameState>()((set, get) => {
  /** Mirrors the live state to localStorage after every scoring action. */
  const snapshotLiveState = () => {
    const state = get();
    if (!state.activeQuizId) return;
    writeSnapshot(state.activeQuizId, extractLiveState(state), state.activeRunId);
  };

  /** Lays a live state over the board that is loaded now. */
  const applyLive = (live: LiveGameState) => {
    const merged = mergeLiveIntoTemplate(extractTemplate(get()), live);
    set({
      categories: merged.categories,
      teams: merged.teams,
      adjustmentLog: merged.adjustmentLog,
      currentTurnTeamId: merged.currentTurnTeamId,
      lastActionAt: merged.lastActionAt,
    });
  };

  /** Takes the given log entries back out of the scores and the log. */
  const withoutEntries = (
    state: Pick<GameState, "teams" | "adjustmentLog">,
    ids: string[]
  ): Pick<GameState, "teams" | "adjustmentLog"> => {
    if (!ids.length) return { teams: state.teams, adjustmentLog: state.adjustmentLog };
    const removed = state.adjustmentLog.filter((entry) => ids.includes(entry.id));
    const deltaByTeam = new Map<string, number>();
    removed.forEach((entry) => {
      deltaByTeam.set(entry.teamId, (deltaByTeam.get(entry.teamId) ?? 0) + entry.delta);
    });
    return {
      teams: state.teams.map((team) =>
        deltaByTeam.has(team.id)
          ? { ...team, score: team.score - (deltaByTeam.get(team.id) ?? 0) }
          : team
      ),
      adjustmentLog: state.adjustmentLog.filter((entry) => !ids.includes(entry.id)),
    };
  };

  const setAnswered = (categoryId: string, questionIndex: number, answered: boolean) => {
    set((state) => ({
      categories: state.categories.map((cat) => {
        if (cat.id !== categoryId) return cat;
        const questions = [...cat.questions];
        const q = questions[questionIndex];
        if (q) questions[questionIndex] = { ...q, answered };
        return { ...cat, questions };
      }),
    }));
  };

  const scheduleTemplateRetry = () => {
    if (templateRetryTimer || templateRetryCount >= TEMPLATE_RETRY_LIMIT) return;
    const delay = 5000 * 3 ** templateRetryCount;
    templateRetryCount += 1;
    templateRetryTimer = setTimeout(() => {
      templateRetryTimer = null;
      void get().saveTemplate();
    }, delay);
  };

  return {
    // A new quiz starts from a blank board, not from the old English demo data:
    // a board already full of someone else's questions is harder to clear than
    // to fill.
    categories: starterCategories(),
    teams: defaultTeams(),
    lastQuestion: null,
    roundStep: null as RoundStep,
    round: initialRoundState(),
    adjustmentLog: [],
    currentTurnTeamId: null as string | null,
    isInitialTurnSelection: false,
    turnRule: DEFAULT_TURN_RULE,
    lastCompletedRound: null,
    lastActionAt: null,
    isPlayingPublicQuiz: false,
    editMode: false,
    selectedCard: null as CardRef | null,
    queue: null,
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
    templateBaseline: null,
    quizUpdatedAt: null,
    saveConflict: false,
    sessionSaveFailed: false,
    activeQuizId: null as string | null,
    activeQuizOwnerId: null as string | null,
    activeQuizCanEdit: false,
    currentUserId: null as string | null,
    currentUserEmail: null as string | null,
    isAnonymousUser: false,
    currentRunStartTime: null as number | null,
    activeRunId: null as string | null,

    // ---- The board -------------------------------------------------------

    /** Replaces the whole board, as an import does: new categories get new
     * ids, and the panel lets go of a card that may no longer exist. */
    setCategories: (categories: Category[]) =>
      set({
        categories: withCategoryIds(categories, "random"),
        selectedCard: null,
        queue: null,
      }),

    addCategory: () =>
      set((state) => ({
        categories: [
          ...state.categories,
          emptyCategory(nextFreeCategoryName(state.categories)),
        ],
      })),

    removeCategory: (index: number) =>
      set((state) => ({
        categories: state.categories.filter((_, i) => i !== index),
        ...remapCards(state.selectedCard, state.queue, (ref) =>
          ref.categoryIndex === index
            ? null
            : ref.categoryIndex > index
              ? { ...ref, categoryIndex: ref.categoryIndex - 1 }
              : ref
        ),
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
          id: newCategoryId(),
          name: uniqueCategoryName(`${source.name} (kopi)`, state.categories),
          questions: source.questions.map((q) => ({ ...q, answered: false })),
        };
        const next = [...state.categories];
        next.splice(categoryIndex + 1, 0, copy);
        return {
          categories: next,
          ...remapCards(state.selectedCard, state.queue, (ref) =>
            ref.categoryIndex > categoryIndex
              ? { ...ref, categoryIndex: ref.categoryIndex + 1 }
              : ref
          ),
        };
      }),

    moveCategory: (categoryIndex: number, direction: -1 | 1) =>
      set((state) => {
        const target = categoryIndex + direction;
        if (target < 0 || target >= state.categories.length) return state;
        const next = [...state.categories];
        [next[categoryIndex], next[target]] = [next[target], next[categoryIndex]];
        return {
          categories: next,
          ...remapCards(state.selectedCard, state.queue, (ref) =>
            ref.categoryIndex === categoryIndex
              ? { ...ref, categoryIndex: target }
              : ref.categoryIndex === target
                ? { ...ref, categoryIndex }
                : ref
          ),
        };
      }),

    addQuestionToCategory: (categoryIndex: number) =>
      set((state) => ({
        categories: normalizePoints(
          state.categories.map((cat, i) =>
            i === categoryIndex
              ? {
                  ...cat,
                  questions: [
                    ...cat.questions,
                    emptyQuestion(nextRung(cat.questions.map((q) => q.points))),
                  ],
                }
              : cat
          )
        ),
      })),

    removeQuestionFromCategory: (categoryIndex: number, questionIndex: number) =>
      set((state) => ({
        categories: state.categories.map((cat, i) => {
          if (i !== categoryIndex) return cat;
          const questions = cat.questions.filter((_, qi) => qi !== questionIndex);
          const evenLadder = ladderAfterRemoval(
            cat.questions.map((q) => q.points),
            questions.length
          );
          if (!evenLadder) return normalizePoints([{ ...cat, questions }])[0];
          return {
            ...cat,
            questions: questions.map((q, qi) =>
              q.points === evenLadder[qi] ? q : { ...q, points: evenLadder[qi] }
            ),
          };
        }),
        ...remapCards(state.selectedCard, state.queue, (ref) => {
          if (ref.categoryIndex !== categoryIndex) return ref;
          if (ref.questionIndex === questionIndex) return null;
          return ref.questionIndex > questionIndex
            ? { ...ref, questionIndex: ref.questionIndex - 1 }
            : ref;
        }),
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
          categories: normalizePoints(
            state.categories.map((cat, i) =>
              i === categoryIndex ? { ...cat, questions } : cat
            )
          ),
          ...remapCards(state.selectedCard, state.queue, (ref) => {
            if (ref.categoryIndex !== categoryIndex) return ref;
            if (ref.questionIndex === questionIndex) return { ...ref, questionIndex: target };
            if (ref.questionIndex === target) return { ...ref, questionIndex };
            return ref;
          }),
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

    // ---- Teams -----------------------------------------------------------

    addTeam: (name?: string) => {
      set((state) => ({
        teams: [
          ...state.teams,
          {
            id: genId(),
            name: name?.trim().slice(0, 80) || `Lag ${state.teams.length + 1}`,
            score: 0,
            players: [],
          },
        ],
      }));
      snapshotLiveState();
    },

    removeTeam: (id: string) => {
      set((state) => {
        const index = state.teams.findIndex((t) => t.id === id);
        const teams = state.teams.filter((t) => t.id !== id);
        // The team that would have come after the removed one picks next,
        // rather than the room having to draw again.
        const heir =
          state.currentTurnTeamId === id && teams.length
            ? teams[index % teams.length].id
            : null;
        return {
          teams,
          currentTurnTeamId:
            state.currentTurnTeamId === id ? heir : state.currentTurnTeamId,
        };
      });
      snapshotLiveState();
    },

    updateTeamName: (id: string, name: string) => {
      set((state) => ({
        teams: state.teams.map((t) =>
          t.id === id ? { ...t, name: name.slice(0, 80) } : t
        ),
      }));
      snapshotLiveState();
    },

    updateTeamPlayers: (id: string, players: string[]) => {
      set((state) => ({
        teams: state.teams.map((t) => (t.id === id ? { ...t, players } : t)),
      }));
      snapshotLiveState();
    },

    // ---- A round -----------------------------------------------------------

    setLastQuestion: (question: LastQuestion | null) => {
      set({
        lastQuestion: question,
        roundStep: question ? "question" : null,
        round: question
          ? { ...initialRoundState(), active: true }
          : initialRoundState(),
      });
    },

    advanceRoundStep: () => {
      set((state) => {
        if (state.roundStep === "question") {
          return {
            roundStep: state.lastQuestion?.isJoker ? "award" : "answer",
          };
        }
        if (state.roundStep === "answer") return { roundStep: "award" };
        return state;
      });
    },

    cancelRound: () => {
      const { round, lastQuestion } = get();
      const reverted = round.entryIds.length > 0;
      set((state) => ({
        ...withoutEntries(state, state.round.entryIds),
        lastQuestion: null,
        roundStep: null,
        round: initialRoundState(),
        ...(reverted ? { lastActionAt: Date.now() } : {}),
      }));
      if (round.positiveEntryId && lastQuestion) {
        setAnswered(lastQuestion.categoryId, lastQuestion.questionIndex, false);
      }
      if (reverted) snapshotLiveState();
    },

    markQuestionAsAnswered: (categoryId: string, questionIndex: number) => {
      setAnswered(categoryId, questionIndex, true);
    },

    toggleQuestionAnswered: (
      categoryId: string,
      questionIndex: number,
      answered: boolean
    ) => {
      setAnswered(categoryId, questionIndex, answered);
      set({ lastActionAt: Date.now() });
      snapshotLiveState();
    },

    awardPositive: (teamId: string, customPoints?: number) => {
      const { lastQuestion, round, roundStep, teams } = get();
      if (!lastQuestion || round.positiveTeamId || roundStep !== "award")
        return;

      const team = teams.find((t) => t.id === teamId);
      if (!team) return;

      const pointsToAward = customPoints ?? lastQuestion.points;

      setAnswered(lastQuestion.categoryId, lastQuestion.questionIndex, true);

      const entry: AdjustmentEntry = {
        id: genId(),
        teamId,
        teamNameSnapshot: team.name,
        delta: pointsToAward,
        reason: `Riktig svar på ${lastQuestion.categoryName} (${lastQuestion.points} poeng)`,
        createdAt: Date.now(),
        type:
          customPoints !== undefined && customPoints !== lastQuestion.points
            ? "custom_scoring"
            : "award",
      };

      set((state) => ({
        teams: state.teams.map((t) =>
          t.id === teamId ? { ...t, score: t.score + pointsToAward } : t
        ),
        round: {
          ...state.round,
          positiveTeamId: teamId,
          positiveEntryId: entry.id,
          entryIds: [...state.round.entryIds, entry.id],
        },
        adjustmentLog: [entry, ...state.adjustmentLog],
        roundStep: "awarded",
        lastActionAt: entry.createdAt,
      }));
      snapshotLiveState();
    },

    awardNegative: (teamId: string, customPoints?: number) => {
      const { lastQuestion, round, roundStep, teams } = get();
      if (
        !lastQuestion ||
        round.positiveTeamId ||
        round.negativeAwardedTo.includes(teamId) ||
        roundStep !== "award"
      )
        return;

      const team = teams.find((t) => t.id === teamId);
      if (!team) return;

      const defaultPenalty = -Math.round(lastQuestion.points * 0.5);
      const penalty = customPoints ?? defaultPenalty;

      const entry: AdjustmentEntry = {
        id: genId(),
        teamId,
        teamNameSnapshot: team.name,
        delta: penalty,
        reason: `Feil svar på ${lastQuestion.categoryName} (standard: ${defaultPenalty})`,
        createdAt: Date.now(),
        type:
          customPoints !== undefined && customPoints !== defaultPenalty
            ? "custom_scoring"
            : "penalty",
      };

      set((state) => ({
        teams: state.teams.map((t) =>
          t.id === teamId ? { ...t, score: t.score + penalty } : t
        ),
        round: {
          ...state.round,
          negativeAwardedTo: [...state.round.negativeAwardedTo, teamId],
          entryIds: [...state.round.entryIds, entry.id],
        },
        adjustmentLog: [entry, ...state.adjustmentLog],
        lastActionAt: entry.createdAt,
      }));
      snapshotLiveState();
    },

    undoLastAward: () => {
      const { roundStep, lastQuestion, round } = get();
      const entryId = round.positiveEntryId;
      if (roundStep !== "awarded" || !lastQuestion || !entryId) return;

      set((state) => ({
        ...withoutEntries(state, [entryId]),
        round: {
          ...state.round,
          positiveTeamId: null,
          positiveEntryId: null,
          entryIds: state.round.entryIds.filter((id) => id !== entryId),
        },
        roundStep: "award",
        lastActionAt: Date.now(),
      }));
      setAnswered(lastQuestion.categoryId, lastQuestion.questionIndex, false);
      snapshotLiveState();
    },

    endRound: () => {
      const { round, lastQuestion, currentTurnTeamId, turnRule } = get();
      if (round.active && lastQuestion) {
        setAnswered(lastQuestion.categoryId, lastQuestion.questionIndex, true);
      }

      const winner = round.positiveTeamId;
      set({
        lastQuestion: null,
        roundStep: null,
        round: initialRoundState(),
        lastCompletedRound: lastQuestion
          ? {
              categoryId: lastQuestion.categoryId,
              categoryName: lastQuestion.categoryName,
              questionIndex: lastQuestion.questionIndex,
              points: lastQuestion.points,
              entryIds: round.entryIds,
              turnBefore: currentTurnTeamId,
            }
          : null,
        lastActionAt: Date.now(),
      });

      // The quiz decides who picks next: the team that took the card, or the
      // next team in order regardless of who answered. With "winner", a card
      // nobody won passes the turn on in order.
      if (
        turnRule === "winner" &&
        winner &&
        get().teams.some((t) => t.id === winner)
      ) {
        set({ currentTurnTeamId: winner, isInitialTurnSelection: false });
      } else {
        get().nextTurn();
      }

      snapshotLiveState();
    },

    undoLastCard: () => {
      const record = get().lastCompletedRound;
      if (!record || get().roundStep) return;
      set((state) => ({
        ...withoutEntries(state, record.entryIds),
        currentTurnTeamId:
          record.turnBefore && state.teams.some((t) => t.id === record.turnBefore)
            ? record.turnBefore
            : state.currentTurnTeamId,
        lastCompletedRound: null,
        lastActionAt: Date.now(),
      }));
      setAnswered(record.categoryId, record.questionIndex, false);
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
          lastActionAt: entry.createdAt,
        };
      });
      snapshotLiveState();
    },

    resetGame: async () => {
      const state = get();

      if (state.activeRunId) {
        try {
          await get().completeSession(state.activeRunId);
        } catch {
          // Resetting anyway left the night's run active on the server, where
          // the next card picked it up and wrote the empty board over it.
          toast({
            title: "Kunne ikke lagre økten",
            description:
              "Brettet er ikke nullstilt. Sjekk nettet og prøv igjen.",
            variant: "destructive",
          });
          return false;
        }
      }
      if (state.activeQuizId) clearSnapshot(state.activeQuizId);

      set((current) => ({
        categories: current.categories.map((cat) => ({
          ...cat,
          questions: cat.questions.map((q) => ({ ...q, answered: false })),
        })),
        teams: current.teams.map((t) => ({ ...t, score: 0 })),
        lastQuestion: null,
        roundStep: null,
        round: initialRoundState(),
        adjustmentLog: [],
        currentTurnTeamId: null,
        isInitialTurnSelection: false,
        lastCompletedRound: null,
        lastActionAt: null,
        activeRunId: null,
        currentRunStartTime: null,
        sessionSaveFailed: false,
      }));
      return true;
    },

    // ---- Quiz settings -----------------------------------------------------

    setQuizTitle: (title: string) => set({ quizTitle: title }),
    setQuizDescription: (description: string) =>
      set({ quizDescription: description }),
    setQuizTimeLimit: (timeLimit: number | null) =>
      set({ quizTimeLimit: timeLimit }),
    setJokerTimeLimit: (timeLimit: number | null) =>
      set({ jokerTimeLimit: timeLimit }),
    setQuizTheme: (theme: QuizTheme) => set({ quizTheme: theme }),
    setQuizIsPublic: (isPublic: boolean) => set({ quizIsPublic: isPublic }),
    setTurnRule: (rule: TurnRule) => set({ turnRule: rule }),

    // ---- The turn ----------------------------------------------------------

    setCurrentTurn: (teamId: string | null) => {
      if (drawTimer) {
        clearTimeout(drawTimer);
        drawTimer = null;
      }
      set({ currentTurnTeamId: teamId, isInitialTurnSelection: false });
      snapshotLiveState();
    },

    initializeTurn: () => {
      const teams = get().teams;
      if (!teams.length) return;

      if (drawTimer) clearTimeout(drawTimer);
      const randomTeamId = teams[Math.floor(Math.random() * teams.length)].id;
      set({ isInitialTurnSelection: true });

      drawTimer = setTimeout(() => {
        drawTimer = null;
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

    /** Passes the turn to the next team in order. With nobody holding the turn
     * it stays empty: a random draw in the middle of a game came as a surprise
     * to everyone, and "Hvem skal starte?" is still there for the host. */
    nextTurn: () => {
      const { teams, currentTurnTeamId } = get();
      if (!teams.length || !currentTurnTeamId) return;
      const currentIndex = teams.findIndex((t) => t.id === currentTurnTeamId);
      const next = teams[(currentIndex + 1) % teams.length];
      set({ currentTurnTeamId: next.id });
    },

    // ---- Editing -----------------------------------------------------------

    setEditMode: (on: boolean) => {
      // Leaving edit mode closes the panel with it; a selected card with no
      // panel visible is state nothing can act on.
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem("editMode", on ? "true" : "false");
        } catch {
          // Without it, a reload starts in play mode.
        }
      }
      set(
        on
          ? { editMode: true, lastQuestion: null, roundStep: null }
          : { editMode: false, selectedCard: null, queue: null }
      );
    },

    selectCard: (ref: CardRef | null) => {
      if (!ref) {
        set({ selectedCard: null, queue: null });
        return;
      }

      const state = get();
      const inActiveQueue =
        state.queue?.active &&
        state.queue.ids.some((id) => sameCard(id, ref));

      if (inActiveQueue && state.queue) {
        // Clicking a card that is part of the running review moves the review
        // to it rather than dropping out of it.
        const position = state.queue.ids.findIndex((id) => sameCard(id, ref));
        set({
          selectedCard: ref,
          queue: { ...state.queue, position: Math.max(0, position) },
        });
        return;
      }

      // Plain inspect: the queue is the whole board in reading order, so
      // "Lagre og neste" always has somewhere to go. No queue header.
      const ids = buildQueue(state.categories, "all");
      const position = ids.findIndex((id) => sameCard(id, ref));
      set({
        selectedCard: ref,
        queue: {
          filter: "all",
          ids,
          position: Math.max(0, position),
          active: false,
        },
      });
    },

    startQueue: (filter: QueueFilter, categoryIndex?: number) => {
      const state = get();
      const ids = buildQueue(state.categories, filter, categoryIndex);
      if (!ids.length) {
        set({ queue: null, selectedCard: null });
        return;
      }
      set({
        editMode: true,
        queue: { filter, categoryIndex, ids, position: 0, active: true },
        selectedCard: ids[0],
      });
    },

    closeQueue: () => {
      const state = get();
      const current = state.selectedCard;
      if (!current) {
        set({ queue: null });
        return;
      }
      // Drops back to plain inspect on the same card instead of closing the
      // panel: the card you were looking at is still the card you want.
      const ids = buildQueue(state.categories, "all");
      const position = ids.findIndex((id) => sameCard(id, current));
      set({
        queue: {
          filter: "all",
          ids,
          position: Math.max(0, position),
          active: false,
        },
      });
    },

    queueNext: () => {
      const { queue } = get();
      if (!queue) return;
      const next = queue.position + 1;
      if (next >= queue.ids.length) {
        // End of the queue. For a review that means done; the header turns into
        // the ready state on its own because the filter no longer matches.
        if (queue.active) set({ queue: { ...queue, position: queue.position } });
        return;
      }
      set({ queue: { ...queue, position: next }, selectedCard: queue.ids[next] });
    },

    queuePrev: () => {
      const { queue } = get();
      if (!queue) return;
      const prev = queue.position - 1;
      if (prev < 0) return;
      set({ queue: { ...queue, position: prev }, selectedCard: queue.ids[prev] });
    },

    // ---- Who is signed in, and which quiz is loaded ---------------------------

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
      get().unloadQuiz();
      rememberPublicPlay(null);
      set({
        currentUserId: null,
        currentUserEmail: null,
        isAnonymousUser: false,
      });
    },

    unloadQuiz: () => {
      const { activeQuizId } = get();
      if (activeQuizId) clearSnapshot(activeQuizId);
      if (drawTimer) {
        clearTimeout(drawTimer);
        drawTimer = null;
      }
      if (templateRetryTimer) {
        clearTimeout(templateRetryTimer);
        templateRetryTimer = null;
      }
      templateRetryCount = 0;

      set({
        categories: starterCategories(),
        teams: defaultTeams(),
        lastQuestion: null,
        roundStep: null,
        round: initialRoundState(),
        adjustmentLog: [],
        currentTurnTeamId: null,
        isInitialTurnSelection: false,
        turnRule: DEFAULT_TURN_RULE,
        lastCompletedRound: null,
        lastActionAt: null,
        isPlayingPublicQuiz: false,
        editMode: false,
        selectedCard: null,
        queue: null,
        quizTitle: "",
        quizDescription: "",
        quizTimeLimit: null,
        jokerTimeLimit: 10,
        quizTheme: "classic",
        quizIsPublic: false,
        activeQuizId: null,
        activeQuizOwnerId: null,
        activeQuizCanEdit: false,
        activeRunId: null,
        currentRunStartTime: null,
        isHydrated: false,
        isLoading: true,
        saveStatus: "idle",
        saveError: null,
        lastSavedAt: null,
        templateBaseline: null,
        quizUpdatedAt: null,
        saveConflict: false,
        sessionSaveFailed: false,
      });
    },

    canEditActiveQuiz: () => {
      const { activeQuizCanEdit, isPlayingPublicQuiz } = get();
      if (isPlayingPublicQuiz) return false;
      return activeQuizCanEdit;
    },

    isOwnerOfActiveQuiz: () => {
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
      updatedAt = null,
      runId = null,
      runStartedAt = null,
      isPublicPlay = false,
      canEdit,
    }: LoadQuizInput) => {
      const normalized: QuizTemplate = {
        ...template,
        categories: withCategoryIds(template.categories, "positional"),
      };
      const merged = mergeLiveIntoTemplate(normalized, live ?? null);
      if (drawTimer) {
        clearTimeout(drawTimer);
        drawTimer = null;
      }
      set({
        categories: merged.categories,
        teams: merged.teams,
        adjustmentLog: merged.adjustmentLog,
        currentTurnTeamId: merged.currentTurnTeamId,
        lastActionAt: merged.lastActionAt,
        quizTitle: normalized.quizTitle,
        quizDescription: normalized.quizDescription,
        quizTimeLimit: normalized.quizTimeLimit,
        jokerTimeLimit: normalized.jokerTimeLimit,
        quizTheme: normalized.quizTheme,
        quizIsPublic: normalized.quizIsPublic,
        turnRule: normalized.turnRule ?? DEFAULT_TURN_RULE,
        activeQuizId: quizId,
        activeQuizOwnerId: quizOwnerId,
        activeQuizCanEdit: canEdit ?? false,
        activeRunId: runId,
        currentRunStartTime: runStartedAt,
        isPlayingPublicQuiz: isPublicPlay,
        editMode: false,
        selectedCard: null,
        queue: null,
        lastQuestion: null,
        roundStep: null,
        round: initialRoundState(),
        isInitialTurnSelection: false,
        lastCompletedRound: null,
        quizUpdatedAt: updatedAt,
        saveConflict: false,
        sessionSaveFailed: false,
        saveStatus: isPublicPlay ? "readonly" : "idle",
        saveError: null,
        isHydrated: true,
        isLoading: false,
      });
      // The baseline is what was loaded, so loading is never mistaken for an edit.
      set({ templateBaseline: templateFingerprint(extractTemplate(get())) });
    },

    // ---- Saving the quiz --------------------------------------------------------

    saveTemplate: (options: SaveTemplateOptions = {}) => {
      const attempt = async (): Promise<boolean> => {
        const state = get();
        const quizId = options.target?.quizId ?? state.activeQuizId;
        if (!quizId) return true;
        const isActive = quizId === state.activeQuizId;

        if (isActive && !state.canEditActiveQuiz()) return true;
        if (isActive && state.saveConflict) return false;

        const template =
          options.target && !isActive ? options.target.template : extractTemplate(state);
        const fingerprint = templateFingerprint(template);
        if (isActive && fingerprint === state.templateBaseline) {
          if (state.saveStatus === "pending") set({ saveStatus: "idle" });
          return true;
        }
        const expectedUpdatedAt =
          options.target && !isActive
            ? options.target.expectedUpdatedAt
            : state.quizUpdatedAt;

        if (isActive) reportSaving();
        try {
          const response = await sendTemplate(
            quizId,
            templateRequestBody(template, expectedUpdatedAt),
            Boolean(options.keepalive)
          );

          if (response.status === 409) {
            if (get().activeQuizId === quizId) {
              set({ saveConflict: true });
              reportSaveError(SAVE_CONFLICT_MESSAGE);
            }
            return false;
          }

          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(body.error || `Lagring feilet (${response.status})`);
          }

          templateRetryCount = 0;
          if (get().activeQuizId === quizId) {
            set({
              templateBaseline: fingerprint,
              quizUpdatedAt: body?.quiz?.updated_at ?? get().quizUpdatedAt,
            });
            reportSaved();
          }
          return true;
        } catch (error) {
          console.error("Failed to save quiz template:", error);
          if (get().activeQuizId === quizId) {
            reportSaveError(
              error instanceof Error ? error.message : "Ukjent lagringsfeil"
            );
            scheduleTemplateRetry();
          }
          return false;
        }
      };

      const result = templateSaveChain.then(attempt, attempt);
      templateSaveChain = result.catch(() => undefined);
      return result;
    },

    waitForTemplateSaves: async () => {
      await templateSaveChain.catch(() => undefined);
    },

    // ---- The live game on the server --------------------------------------------

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
              finalState: extractLiveState(get()),
            }),
          });

          if (!response.ok) {
            throw new Error(`Kunne ikke starte økt (${response.status})`);
          }

          const { run, reused } = await response.json();
          if (get().activeQuizId !== quizId) return null;

          // This tab did not know about the run, or it would have used
          // activeRunId. If something already happened in it, writing this
          // board over it would erase that game, so the game is continued.
          const serverLive = reused ? liveStateFromRunState(run.final_state) : null;
          if (serverLive && hasSessionProgress(serverLive)) {
            applyLive(serverLive);
            toast({
              title: "Fortsetter økten som allerede pågikk",
              description:
                "Poengene derfra er hentet inn. Vil du starte på nytt, velg «Nullstill spillet».",
            });
          }

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
      const runId = state.activeRunId;
      const live = extractLiveState(state);

      if (state.activeQuizId) {
        writeSnapshot(state.activeQuizId, live, runId);
      }

      try {
        const response = await fetch(`/api/quiz-runs/${runId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ finalState: live }),
        });
        if (!response.ok) throw new Error(`Status ${response.status}`);
        if (get().activeRunId === runId && get().sessionSaveFailed) {
          set({ sessionSaveFailed: false });
        }
      } catch (error) {
        // The local snapshot above already holds this state, so the game keeps
        // going and the next successful write catches up. The host is told,
        // since a game that only exists in this browser is lost with it.
        console.error("Error saving session:", error);
        if (get().activeRunId === runId) set({ sessionSaveFailed: true });
      }
    },

    restoreActiveSession: async (quizId: string) => {
      try {
        const response = await fetch(`/api/quiz-runs/active?quizId=${quizId}`);
        if (!response.ok) throw new Error("Failed to restore active session");

        const { run } = await response.json();
        if (!run) {
          get().applySnapshotWithoutRun(quizId);
          return;
        }

        const serverLive = liveStateFromRunState(run.final_state);
        const snapshot = readSnapshot(quizId);
        const live = snapshotIsAhead(snapshot, serverLive, run.id)
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
    },

    applySnapshotWithoutRun: (quizId: string) => {
      const snapshot = readSnapshot(quizId);
      if (!snapshot) return;
      // A snapshot that belongs to a run is from a game that has since been
      // finished, on this device or another; it is not this game.
      if (snapshot.runId || !isSnapshotUsable(snapshot)) {
        clearSnapshot(quizId);
        return;
      }
      applyLive(snapshot.live);
    },

    peekActiveSession: async (quizId: string) => {
      const response = await fetch(`/api/quiz-runs/active?quizId=${quizId}`);
      if (!response.ok) {
        throw new Error(`Kunne ikke sjekke om en økt pågår (${response.status})`);
      }

      const { run } = await response.json();
      if (!run) return null;

      const live = liveStateFromRunState(run.final_state);
      const state = get();
      const merged = mergeLiveIntoTemplate(extractTemplate(state), live);

      return {
        runId: run.id as string,
        startedAt: run.started_at as string,
        answered: merged.categories.reduce(
          (sum, c) => sum + c.questions.filter((q) => q.answered).length,
          0
        ),
        total: state.categories.reduce((sum, c) => sum + c.questions.length, 0),
        teams: merged.teams.map((t) => ({ name: t.name, score: t.score })),
        hasProgress: hasSessionProgress(live),
      };
    },

    completeSession: async (runId: string, quizId?: string) => {
      const state = get();
      const sessionQuizId = quizId || state.activeQuizId;
      if (!sessionQuizId) return null;

      if (pendingSessionSave) {
        clearTimeout(pendingSessionSave);
        pendingSessionSave = null;
      }

      const response = await fetch(`/api/quiz-runs/${runId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finalState: extractLiveState(state),
          teams: state.teams.map((t: Team) => ({
            id: t.id,
            name: t.name,
            score: t.score,
            players: t.players,
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

      const { run } = await response.json();

      try {
        void getQueryClient().invalidateQueries({ queryKey: quizRunKeys.all });
      } catch {
        // History refetches on its own the next time it goes stale.
      }

      // A late answer for a run this tab has already left must not wipe the
      // game that is being played now.
      if (get().activeRunId !== runId) return run as QuizRun;

      clearSnapshot(sessionQuizId);
      // Finishing a session archives the night and hands the board back
      // clean. Leaving the scores on screen would mean the board disagrees
      // with what is stored the moment anyone reloads, since the live state
      // this came from no longer exists.
      set((current) => ({
        activeRunId: null,
        currentRunStartTime: null,
        categories: current.categories.map((cat) => ({
          ...cat,
          questions: cat.questions.map((q) => ({ ...q, answered: false })),
        })),
        teams: current.teams.map((t) => ({ ...t, score: 0 })),
        adjustmentLog: [],
        currentTurnTeamId: null,
        lastCompletedRound: null,
        lastActionAt: null,
        lastQuestion: null,
        roundStep: null,
        round: initialRoundState(),
        sessionSaveFailed: false,
      }));

      return run as QuizRun;
    },
  };
});
