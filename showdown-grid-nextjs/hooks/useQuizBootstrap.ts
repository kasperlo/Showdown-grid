import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/utils/store";
import { templateFromQuizData } from "@/utils/quiz-template";
import { readPublicPlay } from "@/utils/live-snapshot";
import type { QuizTheme } from "@/utils/types";

export type BootstrapState =
  | { status: "loading" }
  | { status: "ready"; quizId: string }
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
  canEdit?: boolean;
  categories?: unknown;
  teams?: unknown;
  jokerTimeLimit?: unknown;
}

/**
 * Loads the board once, from one place.
 *
 * Both the game page and the editor need the same thing: the stored template,
 * plus whatever live session is running on top of it. Doing it in one hook is
 * also what keeps a refetch from overwriting a running game — the fetch happens
 * once per mount, not on every focus change.
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
        const response = await fetch(url);
        if (!isCurrent()) return;

        if (response.status === 404 || response.status === 403) {
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
          canEdit: data.canEdit,
          isPublicPlay,
        });

        // The board is usable from here; the session restore that follows only
        // adds scores, so the page is released before awaiting it.
        setState({ status: "ready", quizId: data.quizId });
        await useGameStore.getState().restoreActiveSession(data.quizId);
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
