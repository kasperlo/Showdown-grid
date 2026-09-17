import { useEffect, useRef } from "react";
import {
  reportSaveError,
  reportSaved,
  reportSaving,
  useGameStore,
} from "@/utils/store";
import { extractTemplate, templateFingerprint } from "@/utils/quiz-template";
import { useDebounce } from "@/utils/useDebounce";
import { useSaveTemplate } from "@/hooks/mutations/useQuizMutations";

/**
 * Saves the quiz template when it actually changes.
 *
 * Two things this gets right that the previous version did not: it only reacts
 * to the debounced value (the old effect listed the raw state in its dependency
 * array as well, so the debounce never held anything back), and it compares a
 * fingerprint of the template, so playing a game — which changes scores and
 * answered flags but not the template — writes nothing at all.
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
  const activeQuizId = useGameStore((s) => s.activeQuizId);
  const isHydrated = useGameStore((s) => s.isHydrated);

  const fingerprint = templateFingerprint(
    extractTemplate({
      categories,
      teams,
      quizTitle,
      quizDescription,
      quizTimeLimit,
      jokerTimeLimit,
      quizTheme,
      quizIsPublic,
    })
  );

  const debouncedFingerprint = useDebounce(fingerprint, 1200);
  const baseline = useRef<{ quizId: string | null; fingerprint: string | null }>(
    { quizId: null, fingerprint: null }
  );
  const { mutate: save } = useSaveTemplate();

  useEffect(() => {
    if (!isHydrated || !activeQuizId) return;

    // A quiz that is not the user's own cannot be written at all, and the
    // indicator should say so rather than pretend to save.
    if (!useGameStore.getState().canEditActiveQuiz()) {
      const { isPlayingPublicQuiz, saveStatus } = useGameStore.getState();
      const next = isPlayingPublicQuiz ? "readonly" : "idle";
      if (saveStatus !== next) useGameStore.setState({ saveStatus: next });
      return;
    }

    // Switching quiz adopts the first fingerprint as already stored; otherwise
    // loading a quiz would immediately write it straight back.
    if (
      baseline.current.quizId !== activeQuizId ||
      baseline.current.fingerprint === null
    ) {
      baseline.current = {
        quizId: activeQuizId,
        fingerprint: debouncedFingerprint,
      };
      return;
    }

    if (baseline.current.fingerprint === debouncedFingerprint) return;

    const target = debouncedFingerprint;
    const template = JSON.parse(target);

    reportSaving();
    save(
      { quizId: activeQuizId, template },
      {
        onSuccess: () => {
          baseline.current = { quizId: activeQuizId, fingerprint: target };
          reportSaved();
        },
        onError: (error: unknown) => {
          // The baseline deliberately does not advance, so the next change
          // retries this content instead of treating it as stored.
          reportSaveError(
            error instanceof Error ? error.message : "Ukjent lagringsfeil"
          );
        },
      }
    );
  }, [debouncedFingerprint, activeQuizId, isHydrated, save]);
}
