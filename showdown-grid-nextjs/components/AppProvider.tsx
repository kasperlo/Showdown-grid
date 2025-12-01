"use client";

import { ReactNode, useEffect } from "react";
import { useGameStore } from "@/utils/store";
import { useDebounce } from "@/utils/useDebounce";
import { useAuth } from "@/hooks/useAuth";
import { useSessionAutoSave } from "@/hooks/useSessionAutoSave";
import { useUpdateQuiz } from "@/hooks/mutations/useQuizMutations";

function FullScreenLoader({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-lg text-muted-foreground">{message}</p>
    </div>
  );
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const {
    isLoading,
    categories,
    teams,
    quizTitle,
    quizDescription,
    adjustmentLog,
    quizTimeLimit,
    quizTheme,
    quizIsPublic,
  } = useGameStore();

  // Use custom auth hook for authentication
  const { isAuthReady } = useAuth();

  // Use TanStack Query mutation for autosave
  // Destructure to get stable references for useEffect dependencies
  const { mutate: saveQuiz, isPending: isSaving } = useUpdateQuiz();

  // Auto-save sessions (for both own and public quizzes)
  useSessionAutoSave();

  // Debounce state changes for autosave
  const debouncedState = useDebounce(
    { categories, teams, quizTitle, quizDescription, adjustmentLog },
    1500
  );

  // Autosave when debounced state changes (but not during initial loading)
  useEffect(() => {
    // Only save if:
    // 1. Not currently loading (avoid saving initial state)
    // 2. Auth is ready
    // 3. No mutation is currently pending (avoid concurrent saves)
    if (!isLoading && isAuthReady && !isSaving) {
      saveQuiz({
        data: {
          categories,
          teams,
          quizTitle,
          quizDescription,
          quizTimeLimit,
          quizTheme,
          quizIsPublic,
          adjustmentLog,
        },
      });
    }
  }, [
    debouncedState,
    isLoading,
    isAuthReady,
    isSaving,
    saveQuiz,
    categories,
    teams,
    quizTitle,
    quizDescription,
    quizTimeLimit,
    quizTheme,
    quizIsPublic,
    adjustmentLog,
  ]);

  // Show loading screen while auth is initializing
  if (!isAuthReady) {
    return <FullScreenLoader message="Laster din quiz..." />;
  }

  return (
    <>
      {isSaving && (
        <div className="fixed bottom-4 right-4 bg-secondary text-secondary-foreground text-sm p-2 rounded-md z-50 animate-pulse">
          Lagrer...
        </div>
      )}
      {children}
    </>
  );
};
