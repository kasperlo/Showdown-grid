"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/utils/store";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Crown,
  Minimize2,
  Tv,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { rankTeams } from "@/utils/ranking";
import { countQuestions } from "@/utils/quiz-template";
import { formatDuration } from "@/utils/format";
import { useQuizBootstrap } from "@/hooks/useQuizBootstrap";
import { usePresentationMode } from "@/hooks/usePresentationMode";
import type { QuizRun } from "@/utils/types";

/** Names printed on one podium step before it collapses to a count. */
const PODIUM_NAMES = 3;

interface DisplayTeam {
  id: string;
  name: string;
  score: number;
  rank: number;
  players: string[];
}

/**
 * The finale, sized for the room rather than for the host's screen.
 *
 * Once a session is saved, completeSession() resets the store's live
 * scores to 0 — that's correct for the board, which needs to come back
 * clean, but it means this page can't keep reading `teams`/`categories`
 * afterward. The server's response to the complete call (duration,
 * per-team results, answered count) is kept in savedRun instead, and every
 * number on screen prefers it once it exists.
 */
export default function Results() {
  const router = useRouter();
  const bootstrap = useQuizBootstrap();
  const presentation = usePresentationMode();
  const teams = useGameStore((s) => s.teams);
  const categories = useGameStore((s) => s.categories);
  const activeRunId = useGameStore((s) => s.activeRunId);
  const completeSession = useGameStore((s) => s.completeSession);
  const quizTitle = useGameStore((s) => s.quizTitle);

  const [isCompleting, setIsCompleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedRun, setSavedRun] = useState<QuizRun | null>(null);

  // A results page's only job is the live numbers — never make the host
  // choose here, just apply whatever session is waiting.
  useEffect(() => {
    if (bootstrap.status === "resumable") void bootstrap.resume();
  }, [bootstrap]);

  const liveRanked = useMemo(() => rankTeams(teams), [teams]);

  const ranked: DisplayTeam[] = savedRun
    ? savedRun.team_results.map((r) => ({
        id: r.teamId,
        name: r.teamName,
        score: r.finalScore,
        rank: r.rank,
        players: [],
      }))
    : liveRanked;

  const hasTeams = ranked.length > 0;
  const total = savedRun ? savedRun.total_questions : countQuestions(categories);
  const answered = savedRun
    ? savedRun.answered_questions
    : categories.reduce(
        (sum, c) => sum + c.questions.filter((q) => q.answered).length,
        0
      );

  const groups = useMemo(() => {
    const byRank: Record<number, DisplayTeam[]> = {};
    for (const team of ranked) {
      if (!byRank[team.rank]) byRank[team.rank] = [];
      byRank[team.rank].push(team);
    }
    return byRank;
  }, [ranked]);

  const ranksToShow = [1, 2, 3].filter((rank) => groups[rank]?.length);
  const topScore = ranked[0]?.score ?? 0;

  const handleComplete = async () => {
    if (!activeRunId) return;
    setIsCompleting(true);
    try {
      const run = await completeSession(activeRunId);
      setSavedRun(run);
      toast({
        title: "Økten er lagret",
        description: "Du finner den under Historikk.",
      });
    } catch (error) {
      toast({
        title: "Kunne ikke fullføre økten",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
      setConfirmOpen(false);
    }
  };

  // Heights in vh so the podium keeps its proportions on a projector instead of
  // shrinking to a fifth of the screen.
  const heightForRank = (rank: number) => {
    const score = groups[rank]?.[0]?.score ?? 0;
    const min = 8;
    const max = 26;
    if (topScore <= 0) return `${min}vh`;
    const fraction = Math.max(0, Math.min(1, score / topScore));
    return `${(min + (max - min) * fraction).toFixed(1)}vh`;
  };

  const colorForRank = (rank: number) =>
    rank === 1 ? "bg-accent" : rank === 2 ? "bg-muted" : "bg-secondary";

  // Each step's digit uses the foreground paired with that step's own
  // background token, the same bg-accent/text-accent-foreground contract
  // GameTopBar and onboarding use, so contrast holds across all three
  // themes regardless of how light or dark that theme's accent/secondary
  // happen to be. Rank 2 keeps the plain foreground token rather than
  // muted-foreground: the latter is tuned for de-emphasized text on the
  // page background, not for full contrast against a filled muted surface.
  const digitColorForRank = (rank: number) =>
    rank === 1
      ? "text-accent-foreground/80"
      : rank === 2
        ? "text-foreground/80"
        : "text-secondary-foreground/80";

  // The classic silver-gold-bronze arrangement only reads as a podium when all
  // three steps are there. With two, it put the winner on the right and the
  // runner-up on the left, which reads as the opposite of what happened.
  const orderForRank = (rank: number) => {
    if (ranksToShow.length < 3) return "order-none";
    return rank === 1 ? "order-2" : rank === 2 ? "order-1" : "order-3";
  };

  if (bootstrap.status === "loading" || bootstrap.status === "resumable") {
    return (
      <div className="stage min-h-dvh p-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="mx-auto h-12 w-64 animate-pulse rounded bg-muted" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (bootstrap.status === "error") {
    return (
      <div className="stage flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold">Kunne ikke laste resultatene</h1>
        <p className="text-muted-foreground">{bootstrap.message}</p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Prøv igjen</Button>
          <Button variant="outline" onClick={() => router.push("/quizzes")}>
            Til biblioteket
          </Button>
        </div>
      </div>
    );
  }

  if (bootstrap.status === "empty") {
    return (
      <div className="stage flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold">Ingen quiz å vise resultater for</h1>
        <p className="text-muted-foreground">
          Denne lenken peker ikke på en quiz du har tilgang til lenger.
        </p>
        <Button onClick={() => router.push("/quizzes")}>Til biblioteket</Button>
      </div>
    );
  }

  return (
    <div className="stage min-h-dvh px-4 pb-10 pt-3 text-foreground sm:px-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        {presentation.active ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-2"
            onClick={presentation.exit}
            title="Tilbake til vertens visning"
          >
            <Minimize2 className="h-4 w-4" />
            <span className="hidden sm:inline">Avslutt</span>
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Tilbake til brettet
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={presentation.enter}
              className="gap-2"
              title="Fullskjerm uten verktøylinje — for projektoren"
            >
              <Tv className="h-4 w-4" />
              <span className="hidden sm:inline">Salen</span>
            </Button>
          </>
        )}
      </div>

      <header className="mb-6 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground sm:text-sm">
          {quizTitle || "Uten navn"}
        </p>
        <h1 className="text-[clamp(2rem,7vh,4.5rem)] font-extrabold tracking-tight text-accent drop-shadow-sm">
          RESULTATER
        </h1>
        {total > 0 && (
          <p className="text-xs text-muted-foreground sm:text-sm">
            {answered} av {total} spørsmål spilt
            {savedRun && (
              <>
                {" "}
                · {formatDuration(savedRun.duration_seconds)} ·{" "}
                {new Date(savedRun.ended_at ?? Date.now()).toLocaleDateString(
                  "nb-NO",
                  { day: "numeric", month: "long" }
                )}
              </>
            )}
          </p>
        )}
      </header>

      {!hasTeams ? (
        <p className="text-center text-muted-foreground">
          Ingen lag i denne økten.
        </p>
      ) : (
        <>
          <section className="mb-10">
            <div className="mx-auto flex w-full max-w-5xl items-end justify-center gap-3 sm:gap-6">
              {ranksToShow.map((rank) => (
                <div
                  key={`rank-${rank}`}
                  className={`flex min-w-0 flex-1 flex-col items-center ${orderForRank(rank)}`}
                >
                  <div className="z-10 mb-2 w-full text-center">
                    {rank === 1 && (
                      <Crown
                        className="mx-auto mb-1 h-[clamp(1.5rem,4vh,3rem)] w-[clamp(1.5rem,4vh,3rem)] text-accent"
                        aria-hidden
                      />
                    )}
                    <div className="flex flex-col items-center gap-1">
                      {/* Capped: eight teams on nil all share rank 2, and
                          naming every one of them on the step made the column
                          taller than the podium it stood on. The rest are in
                          the standings underneath. */}
                      {groups[rank].slice(0, PODIUM_NAMES).map((team) => (
                        <div key={team.id} className="w-full min-w-0">
                          <p
                            className={`truncate font-bold leading-tight ${
                              rank === 1
                                ? "text-[clamp(1.1rem,3.6vh,2.6rem)]"
                                : "text-[clamp(0.9rem,2.5vh,1.6rem)]"
                            }`}
                            title={team.name}
                          >
                            {team.name}
                          </p>
                          <p
                            className={`font-extrabold tabular-nums text-accent ${
                              rank === 1
                                ? "text-[clamp(1.3rem,4.4vh,3.2rem)]"
                                : "text-[clamp(1rem,3vh,2rem)]"
                            }`}
                          >
                            {team.score}
                          </p>
                        </div>
                      ))}
                      {groups[rank].length > PODIUM_NAMES && (
                        <p className="text-xs text-muted-foreground sm:text-sm">
                          +{groups[rank].length - PODIUM_NAMES} flere
                        </p>
                      )}
                    </div>
                  </div>
                  <div
                    className={`flex w-full items-start justify-center rounded-t-xl border border-border pt-2 shadow-2xl ${colorForRank(
                      rank,
                    )}`}
                    style={{ height: heightForRank(rank) }}
                  >
                    <span
                      className={`text-[clamp(1.25rem,3.6vh,2.75rem)] font-black ${digitColorForRank(rank)}`}
                    >
                      {rank}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {ranked.length > ranksToShow.length && (
            <section className="mx-auto max-w-3xl">
              <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {ranked.map((team) => (
                  <li
                    key={team.id}
                    className="flex items-center justify-between gap-3 bg-popover/40 px-4 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={[
                          "w-8 shrink-0 text-center text-lg font-bold tabular-nums",
                          team.rank === 1
                            ? "text-accent"
                            : team.rank === 2
                              ? "text-muted-foreground"
                              : team.rank === 3
                                ? "text-secondary"
                                : "text-foreground/70",
                        ].join(" ")}
                      >
                        {team.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-base font-medium sm:text-lg">
                          {team.name}
                        </p>
                        {team.players.length > 0 && (
                          <p className="truncate text-xs text-muted-foreground">
                            {team.players.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-xl font-bold tabular-nums text-accent sm:text-2xl">
                      {team.score}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      <div className="mx-auto mt-10 flex max-w-3xl flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
        <span
          className={
            savedRun
              ? "inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success"
              : "inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive"
          }
        >
          {savedRun ? (
            <>
              <CheckCircle className="h-3.5 w-3.5" />
              Lagret i historikken kl.{" "}
              {new Date(savedRun.ended_at ?? Date.now()).toLocaleTimeString(
                "nb-NO",
                { hour: "2-digit", minute: "2-digit" }
              )}
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5" />
              Ikke lagret ennå
            </>
          )}
        </span>

        <div className="flex flex-wrap justify-center gap-2">
          {savedRun ? (
            <>
              <Button onClick={() => router.push("/")}>
                Spill denne quizen igjen
              </Button>
              <Button variant="outline" onClick={() => router.push("/history")}>
                Se økten i historikken
              </Button>
              <Button variant="ghost" onClick={() => router.push("/quizzes")}>
                Til biblioteket
              </Button>
            </>
          ) : hasTeams && activeRunId ? (
            <Button onClick={() => setConfirmOpen(true)} disabled={isCompleting}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {isCompleting ? "Fullfører…" : "Fullfør og lagre økten"}
            </Button>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              <p>Ingen aktiv økt å lagre.</p>
              <p>
                Åpne{" "}
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => router.push("/")}
                >
                  brettet
                </button>{" "}
                og spill minst ett spørsmål for å starte en økt.
              </p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fullføre økten?</AlertDialogTitle>
            <AlertDialogDescription>
              Resultatet lagres i historikken, og brettet nullstilles så quizen
              er klar til neste gang. Poengene finner du igjen under Historikk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete}>
              Fullfør
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
