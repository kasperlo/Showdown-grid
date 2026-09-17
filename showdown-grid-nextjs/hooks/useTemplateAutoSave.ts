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
 * Three rules, each of which was broken before:
 *
 * 1. It compares a fingerprint of the TEMPLATE, so playing a game — which
 *    changes scores and answered flags but not the template — writes nothing.
 * 2. It only writes once the debounce has settled. The old effect listed the raw
 *    state in its dependency array too, so the debounce held nothing back.
 * 3. Loading a quiz is not an edit, and neither is switching between them.
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

  // The baseline has to come from the CURRENT fingerprint, not the debounced
  // one. Loading a quiz changes both the id and the board in the same update,
  // and the debounced value still holds the previous board for another 1200 ms —
  // so taking the baseline from it made every load write the quiz straight back.
  useEffect(() => {
    if (baseline.current.quizId !== activeQuizId) {
      baseline.current = { quizId: activeQuizId, fingerprint };
    }
  }, [activeQuizId, fingerprint]);

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

    // The effect above owns the baseline; until it has one for this quiz there
    // is nothing to compare against.
    if (
      baseline.current.quizId !== activeQuizId ||
      baseline.current.fingerprint === null
    ) {
      return;
    }

    // The debounced value can be OLDER than the baseline, not just newer:
    // loading a quiz changes the board instantly while the debounce still holds
    // the previous one for 1200 ms. Saving then wrote the state the app had
    // before the load — an empty board with an empty title, which the server
    // rejected with 400. Only a settled debounce is a real edit.
    if (debouncedFingerprint !== fingerprint) return;

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
  }, [debouncedFingerprint, fingerprint, activeQuizId, isHydrated, save]);
}
