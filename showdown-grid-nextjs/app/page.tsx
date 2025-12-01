"use client";

import { useEffect, useState, useCallback } from "react";
import { GameBoard } from "@/components/GameBoard";
import { Ranking } from "@/components/Ranking";
import { RoundDock } from "@/components/RoundDock";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Settings, History, UserPlus } from "lucide-react";
import { useGameStore } from "@/utils/store";
import { QuizSelector } from "@/components/QuizSelector";
import { TurnIndicator } from "@/components/TurnIndicator";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useActiveQuiz, useQuizzesList } from "@/hooks/queries/useQuizzes";
import type { QuizTheme } from "@/utils/types";

export default function Home() {
  const router = useRouter();
  const { isAuthReady, isAuthError } = useAuth();

  // Optimize store selectors to reduce re-renders
  const quizTitle = useGameStore((state) => state.quizTitle);
  const quizDescription = useGameStore((state) => state.quizDescription);
  const activeQuizId = useGameStore((state) => state.activeQuizId);
  const activeQuizOwnerId = useGameStore((state) => state.activeQuizOwnerId);
  const setCategories = useGameStore((state) => state.setCategories);
  const setQuizTitle = useGameStore((state) => state.setQuizTitle);
  const setQuizDescription = useGameStore((state) => state.setQuizDescription);
  const setQuizTimeLimit = useGameStore((state) => state.setQuizTimeLimit);
  const setQuizTheme = useGameStore((state) => state.setQuizTheme);
  const setQuizIsPublic = useGameStore((state) => state.setQuizIsPublic);
  const isPlayingPublicQuiz = useGameStore(
    (state) => state.isPlayingPublicQuiz
  );
  const restoreActiveSession = useGameStore(
    (state) => state.restoreActiveSession
  );

  // Use TanStack Query for server state
  // Disable useActiveQuiz when playing a public quiz (to avoid overwriting it)
  const { data: activeQuizData, isLoading: isLoadingQuiz } = useActiveQuiz(
    !isPlayingPublicQuiz
  );
  const { data: quizzesList = [], isLoading: isLoadingQuizzesList } =
    useQuizzesList();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get user info
  useEffect(() => {
    if (!isAuthReady || isAuthError) {
      return;
    }

    const getUserInfo = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      setIsAnonymous(user?.is_anonymous || false);
    };

    getUserInfo();
  }, [isAuthReady, isAuthError]);

  // Stable callback to sync quiz data from query to Zustand store
  const syncQuizDataToStore = useCallback(
    (quizData: any) => {
      setCategories(quizData.categories || []);
      useGameStore.setState({
        teams: quizData.teams || [],
        adjustmentLog: quizData.adjustmentLog || [],
        activeQuizId: quizData.quizId,
        activeQuizOwnerId: quizData.quizOwnerId,
      });
      setQuizTitle(quizData.quizTitle || "");
      setQuizDescription(quizData.quizDescription || "");
      setQuizTimeLimit(quizData.quizTimeLimit);
      setQuizTheme((quizData.quizTheme as QuizTheme) || "classic");
      setQuizIsPublic(quizData.quizIsPublic || false);
    },
    [
      setCategories,
      setQuizTitle,
      setQuizDescription,
      setQuizTimeLimit,
      setQuizTheme,
      setQuizIsPublic,
    ]
  );

  // Sync active quiz data from query to Zustand store
  useEffect(() => {
    if (!isAuthReady || isAuthError) {
      return;
    }

    // If playing a public quiz, don't sync from query (data is already in Zustand)
    if (isPlayingPublicQuiz) {
      setIsInitialized(true);
      return;
    }

    // For own quizzes, wait for query to load
    if (isLoadingQuiz) {
      return;
    }

    if (activeQuizData) {
      // Update Zustand state with quiz data
      syncQuizDataToStore(activeQuizData);

      // Restore active session if quiz has an ID (only for own quizzes, not public)
      if (activeQuizData.quizId) {
        restoreActiveSession(activeQuizData.quizId).catch((error) => {
          console.error("Failed to restore active session:", error);
        });
      }

      setIsInitialized(true);
    } else {
      // No active quiz found
      setIsInitialized(true);
    }
  }, [
    isAuthReady,
    isAuthError,
    isLoadingQuiz,
    activeQuizData,
    syncQuizDataToStore,
    restoreActiveSession,
    isPlayingPublicQuiz,
  ]);

  // Handle redirect after initialization completes
  useEffect(() => {
    if (
      isInitialized &&
      !isLoadingQuiz &&
      !isLoadingQuizzesList &&
      !activeQuizId &&
      quizzesList.length === 0
    ) {
      router.push("/quizzes");
    }
  }, [
    isInitialized,
    isLoadingQuiz,
    isLoadingQuizzesList,
    activeQuizId,
    quizzesList,
    router,
  ]);

  // Turn selection is now manual via TurnIndicator component
  // Removed automatic initializeTurn() - user clicks "Hvem skal starte?" button instead

  // Derived state: check if current user owns the active quiz
  const isOwner =
    currentUserId && activeQuizOwnerId && currentUserId === activeQuizOwnerId;

  return (
    <main className="stage min-h-screen">
      <div className="container mx-auto p-4 md:p-8">
        <header className="text-center mb-10 relative">
          <TurnIndicator />
          <h1 className="display-xl text-accent drop-shadow-sm">{quizTitle}</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {quizDescription}
          </p>
          <div className="absolute top-0 right-0 flex items-center gap-2">
            {isAnonymous && (
              <Button
                variant="default"
                size="sm"
                onClick={() => router.push("/signup")}
                className="bg-primary hover:bg-primary/90"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Opprett konto
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/history")}
              aria-label="Se historikk"
              title="Historikk"
            >
              <History className="h-8 w-8" />
            </Button>
            <QuizSelector />
            {isOwner && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/setup")}
                aria-label="Åpne oppsett"
                title="Oppsett"
              >
                <Settings className="h-8 w-8" />
              </Button>
            )}
          </div>
        </header>

        <section className="mb-10">
          <GameBoard />
        </section>

        <section className="mt-12">
          <Ranking />
        </section>

        <div className="mt-16 text-center">
          <Button
            onClick={() => router.push("/results")}
            className="bg-accent text-accent-foreground font-bold text-2xl px-12 py-6 rounded-xl shadow-lg transition-transform hover:scale-105"
          >
            RESULTATER
          </Button>
        </div>
      </div>

      <RoundDock />
    </main>
  );
}
