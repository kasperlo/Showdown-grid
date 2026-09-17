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
 * exactly once per quiz, not on every focus change.
 */
export function useQuizBootstrap(): BootstrapState {
  const [state, setState] = useState<BootstrapState>({ status: "loading" });
  const loadQuiz = useGameStore((s) => s.loadQuiz);
  const restoreActiveSession = useGameStore((s) => s.restoreActiveSession);
  const activeQuizId = useGameStore((s) => s.activeQuizId);
  const isHydrated = useGameStore((s) => s.isHydrated);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (isHydrated && activeQuizId) {
      // Already loaded in this tab (for example navigating editor → game).
      startedRef.current = true;
      setState({ status: "ready", quizId: activeQuizId });
      return;
    }
    startedRef.current = true;

    let cancelled = false;

    const run = async () => {
      const publicQuizId = readPublicPlay();
      const url = publicQuizId
        ? `/api/quizzes/${publicQuizId}/load`
        : "/api/quiz";

      try {
        const response = await fetch(url);

        if (response.status === 404 || response.status === 403) {
          if (!cancelled) {
            useGameStore.getState().setHydrated(true);
            setState({ status: "empty" });
          }
          return;
        }
        if (response.status === 401) {
          if (!cancelled) setState({ status: "empty" });
          return;
        }
        if (!response.ok) {
          throw new Error(`Kunne ikke laste quiz (${response.status})`);
        }

        const { data } = (await response.json()) as { data: RawQuizPayload };
        if (cancelled) return;

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

        loadQuiz({
          template,
          quizId: data.quizId,
          quizOwnerId: data.quizOwnerId,
          isPublicPlay,
        });

        await restoreActiveSession(data.quizId);
        if (!cancelled) setState({ status: "ready", quizId: data.quizId });
      } catch (error) {
        if (cancelled) return;
        useGameStore.getState().setHydrated(true);
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Ukjent feil",
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadQuiz, restoreActiveSession, activeQuizId, isHydrated]);

  return state;
}

function normalizeTheme(theme: string | null | undefined): QuizTheme {
  return theme === "modern" || theme === "christmas" ? theme : "classic";
}
