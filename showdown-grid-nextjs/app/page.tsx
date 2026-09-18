"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GameStage } from "@/components/GameStage";
import { EditorBar } from "@/components/editor/EditorBar";
import { EditableBoard } from "@/components/editor/EditableBoard";
import { EditableQuizTitle } from "@/components/editor/EditableQuizTitle";
import { QuestionInspector } from "@/components/editor/QuestionInspector";
import { BoardLegend } from "@/components/editor/BoardLegend";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useIsWideScreen } from "@/hooks/useMediaQuery";
import { useQuizBootstrap } from "@/hooks/useQuizBootstrap";
import { toast } from "@/hooks/use-toast";
import { useGameStore } from "@/utils/store";
import { countCompleteQuestions, countQuestions } from "@/utils/quiz-template";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useAuth();
  const bootstrap = useQuizBootstrap();

  const categories = useGameStore((s) => s.categories);
  const canEdit = useGameStore((s) => s.canEditActiveQuiz());
  const editMode = useGameStore((s) => s.editMode);
  const setEditMode = useGameStore((s) => s.setEditMode);
  const selectedCard = useGameStore((s) => s.selectedCard);
  const selectCard = useGameStore((s) => s.selectCard);
  const isWide = useIsWideScreen();

  // ?mode=edit makes the editor a shareable link and gives /setup somewhere to
  // redirect to.
  useEffect(() => {
    if (bootstrap.status !== "ready" || !canEdit) return;
    if (searchParams.get("mode") === "edit") setEditMode(true);
  }, [bootstrap.status, canEdit, searchParams, setEditMode]);

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
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl bg-muted"
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (bootstrap.status === "resumable") {
    const { run } = bootstrap;
    const started = new Date(run.startedAt);

    const handleStartFresh = async () => {
      try {
        await bootstrap.startFresh();
      } catch (error) {
        toast({
          title: "Kunne ikke starte ny økt",
          description: error instanceof Error ? error.message : undefined,
          variant: "destructive",
        });
      }
    };

    const handleResumeAndShowResults = async () => {
      try {
        const ok = await bootstrap.resume();
        if (ok) {
          router.push("/results");
        } else {
          toast({
            title: "Kunne ikke gjenoppta økten",
            description: "Prøv igjen, eller fortsett økten direkte.",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Kunne ikke gjenoppta økten",
          description: error instanceof Error ? error.message : undefined,
          variant: "destructive",
        });
      }
    };

    return (
      <main className="stage flex min-h-dvh items-center justify-center p-6">
        <div className="glass w-full max-w-xl rounded-2xl p-8">
          <h2 className="text-xl font-bold">En økt pågår allerede</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Startet{" "}
            {started.toLocaleString("nb-NO", {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            · {run.answered} av {run.total} kort spilt
          </p>

          {run.teams.length > 0 && (
            <ul className="mt-4 space-y-1">
              {run.teams.map((team) => (
                <li
                  key={team.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate">{team.name}</span>
                  <span className="font-bold tabular-nums text-accent">
                    {team.score}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => void bootstrap.resume()}>
              Fortsett økten
            </Button>
            <Button variant="outline" onClick={() => void handleStartFresh()}>
              Start en ny økt med samme quiz
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleResumeAndShowResults()}
            >
              Se resultatet fra økten som pågår
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Økten over lagres i historikken. Brettet nullstilles, og alle lag
            starter på 0.
          </p>
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

  if (editMode) {
    return (
      <main className="stage min-h-screen">
        {/* Board left, inspector right. The panel is a fixed 404px so the board
            keeps the same column widths while you work in it. */}
        <div
          className={
            isWide
              ? "grid min-h-screen grid-cols-[minmax(0,1fr)_clamp(360px,24vw,460px)]"
              : undefined
          }
        >
          <div className="container mx-auto p-4 md:p-8 xl:mx-0 xl:max-w-none">
            <EditorBar />
            <div className="mb-8">
              <EditableQuizTitle />
            </div>
            <EditableBoard />
            <BoardLegend />
          </div>

          {isWide && (
            <div className="sticky top-0 h-screen border-l border-border">
              {selectedCard ? (
                <QuestionInspector />
              ) : (
                <p className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
                  Velg et kort
                </p>
              )}
            </div>
          )}
        </div>

        {/* Below xl the panel is a sheet, so the board keeps the full width.
            Mounted only for that breakpoint: rendering both would put two
            inspectors on the page and dim the desktop layout with the sheet's
            own overlay. */}
        {!isWide && (
          <Sheet
            open={!!selectedCard}
            onOpenChange={(open) => !open && selectCard(null)}
          >
            <SheetContent
              side="right"
              className="w-full p-0 sm:max-w-md"
              hideCloseButton
            >
              {/* Radix needs a title on every dialog for screen readers; the
                  inspector already shows the card it is editing, so this one is
                  for assistive tech only. */}
              <SheetHeader className="sr-only">
                <SheetTitle>Rediger kort</SheetTitle>
              </SheetHeader>
              <QuestionInspector />
            </SheetContent>
          </Sheet>
        )}
      </main>
    );
  }

  if (boardIsEmpty) {
    return (
      <main className="stage flex min-h-dvh items-center justify-center p-6">
        <div className="glass w-full max-w-xl rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold">Ingen spørsmål enda</h2>
          <p className="mt-2 text-muted-foreground">
            {total === 0
              ? "Denne quizen har ingen kategorier."
              : `${total} kort står tomme.`}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {canEdit && (
              <Button onClick={() => setEditMode(true)}>Rediger brettet</Button>
            )}
            <Button variant="outline" onClick={() => router.push("/quizzes")}>
              Til biblioteket
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return <GameStage />;
}
