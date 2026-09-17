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
 * exactly once per mount, not on every focus change.
 *
 * The cancel flag is a ref rather than a per-effect local: loading the quiz
 * updates the store, which re-renders, which would re-run the effect and cancel
 * the load that was still finishing.
 */
export function useQuizBootstrap(): BootstrapState {
  const [state, setState] = useState<BootstrapState>(() => {
    const store = useGameStore.getState();
    return store.isHydrated && store.activeQuizId
      ? { status: "ready", quizId: store.activeQuizId }
      : { status: "loading" };
  });
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    const store = useGameStore.getState();

    // Already loaded in this tab, for example navigating editor → game.
    if (store.isHydrated && store.activeQuizId) {
      setState({ status: "ready", quizId: store.activeQuizId });
      return () => {
        aliveRef.current = false;
      };
    }

    const run = async () => {
      const publicQuizId = readPublicPlay();
      const url = publicQuizId
        ? `/api/quizzes/${publicQuizId}/load`
        : "/api/quiz";

      try {
        const response = await fetch(url);
        if (!aliveRef.current) return;

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
        if (!aliveRef.current) return;

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
          isPublicPlay,
        });

        // The board is usable from here; the session restore that follows only
        // adds scores, so the page is released before awaiting it.
        setState({ status: "ready", quizId: data.quizId });
        await useGameStore.getState().restoreActiveSession(data.quizId);
      } catch (error) {
        if (!aliveRef.current) return;
        useGameStore.getState().setHydrated(true);
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Ukjent feil",
        });
      }
    };

    void run();

    return () => {
      aliveRef.current = false;
    };
  }, []);

  return state;
}

function normalizeTheme(theme: string | null | undefined): QuizTheme {
  return theme === "modern" || theme === "christmas" ? theme : "classic";
}
