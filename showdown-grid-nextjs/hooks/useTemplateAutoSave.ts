import { useEffect, useRef } from "react";
import { useGameStore } from "@/utils/store";
import { extractTemplate, templateFingerprint } from "@/utils/quiz-template";
import { useDebounce } from "@/utils/useDebounce";
import type { QuizTemplate } from "@/utils/types";

/**
 * Saves the quiz template when it actually changes. The saving itself, and
 * the queue that keeps saves from overlapping, live in the store
 * (saveTemplate); this hook decides when.
 *
 * - It compares a fingerprint of the TEMPLATE, so playing a game — which
 *   changes scores and answered flags but not the template — writes nothing.
 * - It writes once the debounce has settled, and shows "pending" until then
 *   rather than the time of the previous save.
 * - Leaving the page, hiding it, or switching to another quiz saves what is
 *   pending instead of dropping it.
 */
export function useTemplateAutoSave() {
  const categories = useGameStore((s) => s.categories);
  const teams = useGameStore((s) => s.teams);
  const quizTitle = useGameStore((s) => s.quizTitle);
  const quizDescription = useGameStore((s) => s.quizDescription);
  const quizTimeLimit = useGameStore((s) => s.quizTimeLimit);
  const jokerTimeLimit = useGameStore((s) => s.jokerTimeLimit);
  const quizTheme = useGameStore((s) => s.quizTheme);
  const quizIsPublic = useGameStore((s) => s.quizIsPublic);
  const turnRule = useGameStore((s) => s.turnRule);
  const activeQuizId = useGameStore((s) => s.activeQuizId);
  const quizUpdatedAt = useGameStore((s) => s.quizUpdatedAt);
  const isHydrated = useGameStore((s) => s.isHydrated);
  const templateBaseline = useGameStore((s) => s.templateBaseline);
  const saveTemplate = useGameStore((s) => s.saveTemplate);

  const template: QuizTemplate = extractTemplate({
    categories,
    teams,
    quizTitle,
    quizDescription,
    quizTimeLimit,
    jokerTimeLimit,
    quizTheme,
    quizIsPublic,
    turnRule,
  });
  const fingerprint = templateFingerprint(template);
  const debouncedFingerprint = useDebounce(fingerprint, 1200);
  const unsaved = isHydrated && !!activeQuizId && fingerprint !== templateBaseline;

  // What was on screen for which quiz, for when the library switches away
  // before the debounce has settled.
  const latest = useRef<{
    quizId: string | null;
    template: QuizTemplate;
    updatedAt: string | null;
    unsaved: boolean;
  } | null>(null);

  useEffect(() => {
    const previous = latest.current;
    if (previous?.quizId && previous.quizId !== activeQuizId && previous.unsaved) {
      void saveTemplate({
        target: {
          quizId: previous.quizId,
          template: previous.template,
          expectedUpdatedAt: previous.updatedAt,
        },
      });
    }
    latest.current = { quizId: activeQuizId, template, updatedAt: quizUpdatedAt, unsaved };
  });

  useEffect(() => {
    if (!isHydrated || !activeQuizId) return;
    const state = useGameStore.getState();

    // A quiz that is not the user's own cannot be written at all, and the
    // indicator should say so rather than pretend to save.
    if (!state.canEditActiveQuiz()) {
      const next = state.isPlayingPublicQuiz ? "readonly" : "idle";
      if (state.saveStatus !== next) useGameStore.setState({ saveStatus: next });
      return;
    }

    if (!unsaved) return;
    if (state.saveStatus === "idle" || state.saveStatus === "saved") {
      useGameStore.setState({ saveStatus: "pending" });
    }

    // Only a settled debounce is a real edit; an unsettled one can even hold
    // the board from before a load.
    if (debouncedFingerprint !== fingerprint) return;
    void saveTemplate();
  }, [debouncedFingerprint, fingerprint, activeQuizId, isHydrated, unsaved, saveTemplate]);

  // Closing the lid or the tab should not drop the last edit.
  useEffect(() => {
    const flush = () => {
      const state = useGameStore.getState();
      if (!state.activeQuizId || !state.canEditActiveQuiz()) return;
      void state.saveTemplate({ keepalive: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
