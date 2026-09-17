"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, SlidersHorizontal } from "lucide-react";
import { useGameStore } from "@/utils/store";
import { useQuizBootstrap } from "@/hooks/useQuizBootstrap";
import { SaveIndicator } from "@/components/SaveIndicator";
import { BoardEditor } from "@/components/editor/BoardEditor";
import { TeamsEditor } from "@/components/editor/TeamsEditor";
import { QuizSettings } from "@/components/editor/QuizSettings";
import AdminAdjust from "@/components/AdminAdjust";

export default function Setup() {
  const router = useRouter();
  const bootstrap = useQuizBootstrap();
  const quizTitle = useGameStore((s) => s.quizTitle);
  const canEdit = useGameStore((s) => s.canEditActiveQuiz());
  const isPublicPlay = useGameStore((s) => s.isPlayingPublicQuiz);
  const saveQuizToDB = useGameStore((s) => s.saveQuizToDB);

  // A quiz that is not yours has nothing to edit, so the editor is not a place
  // to sit and wonder why nothing saves.
  useEffect(() => {
    if (bootstrap.status === "ready" && !canEdit) router.replace("/");
  }, [bootstrap.status, canEdit, router]);

  useEffect(() => {
    if (bootstrap.status === "empty") router.replace("/quizzes");
  }, [bootstrap.status, router]);

  if (bootstrap.status === "loading" || bootstrap.status === "empty") {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="container mx-auto max-w-6xl space-y-4">
          <div className="h-10 w-48 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (bootstrap.status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <h1 className="text-2xl font-bold">Kunne ikke laste quizen</h1>
        <p className="text-muted-foreground">{bootstrap.message}</p>
        <Button onClick={() => router.push("/quizzes")}>Til biblioteket</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              aria-label="Tilbake til spillet"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Redigerer
              </p>
              <h1 className="truncate text-xl font-bold text-accent sm:text-2xl">
                {quizTitle || "Uten navn"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SaveIndicator />
            {/* Autosave covers the normal case; this is for when it failed and
                the host wants to try again before leaving the page. */}
            <Button variant="outline" size="sm" onClick={() => saveQuizToDB()}>
              Lagre nå
            </Button>
            <Button
              size="sm"
              className="gap-2 bg-accent font-bold text-accent-foreground"
              onClick={() => router.push("/")}
            >
              <Play className="h-4 w-4" />
              Til spillet
            </Button>
          </div>
        </div>

        {isPublicPlay && (
          <p className="mb-4 rounded-lg border border-border bg-muted/50 p-3 text-sm">
            Dette er en offentlig quiz du spiller. Lag en kopi fra biblioteket
            for å endre den.
          </p>
        )}

        <Tabs defaultValue="board" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-popover">
            <TabsTrigger value="board">Brett</TabsTrigger>
            <TabsTrigger value="teams">Lag</TabsTrigger>
            <TabsTrigger value="settings">
              <SlidersHorizontal className="mr-2 hidden h-4 w-4 sm:inline" />
              Innstillinger
            </TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="mt-4">
            <BoardEditor />
          </TabsContent>

          <TabsContent value="teams" className="mt-4">
            <div className="glass space-y-8 rounded-lg p-4 sm:p-6">
              <TeamsEditor />
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold">Manuell poengjustering</h3>
                <p className="mb-4 mt-1 text-sm text-muted-foreground">
                  Skjer utenfor runder og loggføres i økten.
                </p>
                <AdminAdjust />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <div className="glass rounded-lg p-4 sm:p-6">
              <QuizSettings />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
