import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/utils/store";
import { templateFromQuizData } from "@/utils/quiz-template";
import { readPublicPlay, rememberPublicPlay } from "@/utils/live-snapshot";
import type { ActiveSessionSummary, QuizTheme } from "@/utils/types";

export type BootstrapState =
  | { status: "loading" }
  | { status: "ready"; quizId: string }
  | {
      status: "resumable";
      quizId: string;
      run: ActiveSessionSummary;
      /**
       * Applies the paused session's scores and switches to "ready".
       * Resolves to whether it succeeded, so a caller that navigates on
       * success (e.g. straight to /results) doesn't do so on a failure.
       */
      resume: () => Promise<boolean>;
      /**
       * Archives the paused session (it lands in history) and starts clean
       * — every team back to 0, every card playable again — then switches
       * to "ready".
       */
      startFresh: () => Promise<void>;
    }
  | { status: "empty" }
  | { status: "error"; message: string };

interface RawQuizPayload {
  quizId: string;
  quizOwnerId: string;
  quizTitle: string;
  quizDescription: string;
  quizTimeLimit: number | null;
  quizTheme: string;
  quizIsPublic: boolean;
  quizUpdatedAt?: string | null;
  canEdit?: boolean;
  categories?: unknown;
  teams?: unknown;
  jokerTimeLimit?: unknown;
  turnRule?: unknown;
}

/**
 * Loads the board once, from one place.
 *
 * Both the game page and the editor need the same thing: the stored
 * template, plus whatever live session is running on top of it. A session
 * with real progress in it is never applied silently — hosting the same
 * quiz for a second group would otherwise pop the first group's scores and
 * checked-off cards onto the projector with no warning. Instead the caller
 * sees "resumable" and decides.
 *
 * Cancellation uses a run counter rather than a boolean: React's development
 * double-mount would otherwise let the first, abandoned load see the flag reset
 * by the second mount and apply its result as well, loading the quiz twice.
 */
export function useQuizBootstrap(): BootstrapState {
  const [state, setState] = useState<BootstrapState>(() => {
    const store = useGameStore.getState();
    return store.isHydrated && store.activeQuizId
      ? { status: "ready", quizId: store.activeQuizId }
      : { status: "loading" };
  });
  const runCounter = useRef(0);

  useEffect(() => {
    const myRun = ++runCounter.current;
    const isCurrent = () => runCounter.current === myRun;
    const store = useGameStore.getState();

    // Already loaded in this tab, for example navigating editor → game.
    if (store.isHydrated && store.activeQuizId) {
      setState({ status: "ready", quizId: store.activeQuizId });
      return;
    }

    const run = async () => {
      const publicQuizId = readPublicPlay();
      const url = publicQuizId
        ? `/api/quizzes/${publicQuizId}/load`
        : "/api/quiz";

      try {
        // A quiz left a moment ago may still be saving; loading before that
        // lands would show the old board and make the next save a conflict.
        await useGameStore.getState().waitForTemplateSaves();
        const response = await fetch(url);
        if (!isCurrent()) return;

        if (response.status === 404 || response.status === 403) {
          // A public quiz that is gone or no longer public: forget it, or
          // every visit to the board would bounce back to the library.
          if (publicQuizId) rememberPublicPlay(null);
          useGameStore.getState().setHydrated(true);
          setState({ status: "empty" });
          return;
        }
        if (response.status === 401) {
          setState({ status: "empty" });
          return;
        }
        if (!response.ok) {
          throw new Error(`Kunne ikke laste quiz (${response.status})`);
        }

        const { data } = (await response.json()) as { data: RawQuizPayload };
        if (!isCurrent()) return;

        const isPublicPlay = Boolean(publicQuizId);
        const template = templateFromQuizData(
          {
            categories: data.categories,
            teams: data.teams,
            jokerTimeLimit: data.jokerTimeLimit,
            turnRule: data.turnRule,
          },
          {
            quizTitle: data.quizTitle,
            quizDescription: data.quizDescription ?? "",
            quizTimeLimit: data.quizTimeLimit,
            quizTheme: normalizeTheme(data.quizTheme),
            quizIsPublic: data.quizIsPublic,
          }
        );

        useGameStore.getState().loadQuiz({
          template,
          quizId: data.quizId,
          quizOwnerId: data.quizOwnerId,
          updatedAt: data.quizUpdatedAt ?? null,
          canEdit: data.canEdit,
          isPublicPlay,
        });

        const quizId = data.quizId;
        let summary: ActiveSessionSummary | null;
        try {
          summary = await useGameStore.getState().peekActiveSession(quizId);
        } catch {
          // Not knowing is not the same as "no session": the first card
          // would then take over a running game. Better to stop here.
          if (!isCurrent()) return;
          setState({
            status: "error",
            message:
              "Fikk ikke sjekket om en økt allerede pågår. Sjekk nettet og prøv igjen.",
          });
          return;
        }
        if (!isCurrent()) return;

        if (!summary) {
          // No session on the server. A game started before the first card
          // (teams typed in, a starting team drawn) only exists here.
          useGameStore.getState().applySnapshotWithoutRun(quizId);
          setState({ status: "ready", quizId });
          return;
        }

        if (!summary.hasProgress) {
          // A session exists but nothing happened in it yet — apply it
          // silently, same as before there was a choice to make.
          await useGameStore.getState().restoreActiveSession(quizId);
          if (!isCurrent()) return;
          setState({ status: "ready", quizId });
          return;
        }

        setState({
          status: "resumable",
          quizId,
          run: summary,
          resume: async () => {
            await useGameStore.getState().restoreActiveSession(quizId);
            if (!isCurrent()) return false;
            if (useGameStore.getState().activeRunId !== summary.runId) {
              // restoreActiveSession swallows its own errors instead of
              // throwing, so a failed fetch would otherwise look identical
              // to success. activeRunId is only set on the real success path.
              setState({
                status: "error",
                message: "Kunne ikke gjenoppta økten. Prøv igjen.",
              });
              return false;
            }
            setState({ status: "ready", quizId });
            return true;
          },
          startFresh: async () => {
            // completeSession archives whatever is currently in the store, so
            // the paused progress must be restored first — otherwise it
            // archives the untouched template (zero scores) and the real
            // night's progress is lost.
            await useGameStore.getState().restoreActiveSession(quizId);
            if (!isCurrent()) return;
            if (useGameStore.getState().activeRunId !== summary.runId) {
              // restoreActiveSession swallows its own errors instead of
              // throwing, so a failed fetch would otherwise look identical
              // to success. activeRunId is only set on the real success path.
              setState({
                status: "error",
                message: "Kunne ikke starte ny økt. Prøv igjen.",
              });
              return;
            }
            await useGameStore.getState().completeSession(summary.runId, quizId);
            if (isCurrent()) setState({ status: "ready", quizId });
          },
        });
      } catch (error) {
        if (!isCurrent()) return;
        useGameStore.getState().setHydrated(true);
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Ukjent feil",
        });
      }
    };

    void run();
  }, []);

  return state;
}

function normalizeTheme(theme: string | null | undefined): QuizTheme {
  return theme === "modern" || theme === "christmas" ? theme : "classic";
}
