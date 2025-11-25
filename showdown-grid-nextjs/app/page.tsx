"use client";

import { useEffect, useState, useCallback } from "react";
import { GameBoard } from "@/components/GameBoard";
import { Ranking } from "@/components/Ranking";
import { RoundDock } from "@/components/RoundDock";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Settings, History } from "lucide-react";
import { useGameStore } from "@/utils/store";
import { QuizSelector } from "@/components/QuizSelector";
import { TurnIndicator } from "@/components/TurnIndicator";
import { createClient } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  // Optimize store selectors to reduce re-renders
  const quizTitle = useGameStore((state) => state.quizTitle);
  const quizDescription = useGameStore((state) => state.quizDescription);
  const activeQuizId = useGameStore((state) => state.activeQuizId);
  const activeQuizOwnerId = useGameStore((state) => state.activeQuizOwnerId);
  const loadQuizFromDB = useGameStore((state) => state.loadQuizFromDB);
  const quizzesList = useGameStore((state) => state.quizzesList);
  const loadQuizzesList = useGameStore((state) => state.loadQuizzesList);
  const isLoading = useGameStore((state) => state.isLoading);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Single comprehensive effect for initialization and redirect
  useEffect(() => {
    const initialize = async () => {
      try {
        // Get current user ID
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setCurrentUserId(user?.id || null);

        // Load quiz data
        await Promise.all([loadQuizFromDB(), loadQuizzesList()]);
      } finally {
        setIsInitialized(true);
      }
    };

    initialize();
  }, [loadQuizFromDB, loadQuizzesList]);

  // Handle redirect after initialization completes
  useEffect(() => {
    if (
      isInitialized &&
      !isLoading &&
      !activeQuizId &&
      quizzesList.length === 0
    ) {
      router.push("/quizzes");
    }
  }, [isInitialized, isLoading, activeQuizId, quizzesList, router]);

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
