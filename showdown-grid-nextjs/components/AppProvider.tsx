"use client";

import { ReactNode, useEffect, useCallback } from "react";
import { useGameStore } from "@/utils/store";
import { useDebounce } from "@/utils/useDebounce";
import { useAuth } from "@/hooks/useAuth";

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
    saveQuizToDB,
    isLoading,
    isSaving,
    categories,
    teams,
    quizTitle,
    quizDescription,
    adjustmentLog,
  } = useGameStore();

  // Use custom auth hook for authentication
  const { isAuthReady } = useAuth();

  // Debounce state changes for autosave
  const debouncedState = useDebounce(
    { categories, teams, quizTitle, quizDescription, adjustmentLog },
    1500
  );

  // Create stable reference for saveQuizToDB
  const stableSaveQuiz = useCallback(() => {
    saveQuizToDB();
  }, [saveQuizToDB]);

  // Autosave when debounced state changes (but not during initial loading)
  useEffect(() => {
    // Only save if not currently loading to avoid saving initial state
    if (!isLoading && isAuthReady) {
      stableSaveQuiz();
    }
  }, [debouncedState, isLoading, isAuthReady, stableSaveQuiz]);

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
