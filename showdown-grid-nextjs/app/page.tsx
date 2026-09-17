"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GameBoard } from "@/components/GameBoard";
import { Scoreboard } from "@/components/Scoreboard";
import { RoundDock } from "@/components/RoundDock";
import { TurnIndicator } from "@/components/TurnIndicator";
import { GameHeader } from "@/components/GameHeader";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useQuizBootstrap } from "@/hooks/useQuizBootstrap";
import { useGameStore } from "@/utils/store";
import { countCompleteQuestions, countQuestions } from "@/utils/quiz-template";

export default function Home() {
  const router = useRouter();
  const { isAuthReady, isAuthError } = useAuth();
  const bootstrap = useQuizBootstrap();

  const categories = useGameStore((s) => s.categories);
  const canEdit = useGameStore((s) => s.canEditActiveQuiz());

  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    if (!isAuthReady || isAuthError) return;
    let cancelled = false;

    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (cancelled) return;
        setUserEmail(data.user?.email);
        setIsAnonymous(data.user?.is_anonymous ?? false);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, isAuthError]);

  // No quiz at all means there is nothing to host; the library is the only
  // useful place to be.
  useEffect(() => {
    if (bootstrap.status === "empty") router.replace("/quizzes");
  }, [bootstrap.status, router]);

  if (bootstrap.status === "loading" || bootstrap.status === "empty") {
    return (
      <main className="stage min-h-screen">
        <div className="container mx-auto p-8">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="h-10 w-1/2 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (bootstrap.status === "error") {
    return (
      <main className="stage min-h-screen">
        <div className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-bold">Kunne ikke laste quizen</h1>
          <p className="text-muted-foreground">{bootstrap.message}</p>
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()}>Prøv igjen</Button>
            <Button variant="outline" onClick={() => router.push("/quizzes")}>
              Til biblioteket
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const total = countQuestions(categories);
  const complete = countCompleteQuestions(categories);
  const boardIsEmpty = total === 0 || complete === 0;

  return (
    <main className="stage min-h-screen pb-40">
      <div className="container mx-auto p-4 md:p-8">
        <GameHeader userEmail={userEmail} isAnonymous={isAnonymous} />

        <div className="mb-8 flex justify-center">
          <TurnIndicator />
        </div>

        {boardIsEmpty ? (
          <div className="glass mx-auto max-w-xl rounded-2xl p-8 text-center">
            <h2 className="text-xl font-bold">Ingen spørsmål enda</h2>
            <p className="mt-2 text-muted-foreground">
              {total === 0
                ? "Denne quizen har ingen kategorier."
                : `${total} felter står tomme. Fyll dem ut før du spiller.`}
            </p>
            {canEdit && (
              <Button className="mt-4" onClick={() => router.push("/setup")}>
                Åpne redigering
              </Button>
            )}
          </div>
        ) : (
          <>
            <section className="mb-10">
              <GameBoard />
            </section>

            {complete < total && (
              <p className="mb-8 text-center text-xs text-muted-foreground">
                {total - complete} av {total} felter mangler innhold. De er
                markert på brettet.
              </p>
            )}

            <section className="mx-auto max-w-3xl">
              <Scoreboard />
            </section>
          </>
        )}
      </div>

      <RoundDock />
    </main>
  );
}
