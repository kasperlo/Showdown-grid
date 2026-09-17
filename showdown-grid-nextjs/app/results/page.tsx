"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/utils/store";
import { ArrowLeft, CheckCircle, Crown, Medal } from "lucide-react";
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
import { useQuizBootstrap } from "@/hooks/useQuizBootstrap";

export default function Results() {
  const router = useRouter();
  // Opening /results directly, or refreshing it, used to render the store's
  // default empty board: "Uten navn", 0 of 25 questions and every team on zero.
  const bootstrap = useQuizBootstrap();
  const teams = useGameStore((s) => s.teams);
  const categories = useGameStore((s) => s.categories);
  const activeRunId = useGameStore((s) => s.activeRunId);
  const completeSession = useGameStore((s) => s.completeSession);
  const quizTitle = useGameStore((s) => s.quizTitle);

  const [isCompleting, setIsCompleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const ranked = useMemo(() => rankTeams(teams), [teams]);
  const hasTeams = ranked.length > 0;
  const total = countQuestions(categories);
  const answered = categories.reduce(
    (sum, c) => sum + c.questions.filter((q) => q.answered).length,
    0
  );

  const groups = useMemo(() => {
    const byRank: Record<number, typeof ranked> = {};
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
      await completeSession(activeRunId);
      toast({
        title: "Økten er lagret",
        description: "Du finner den under Historikk.",
      });
      router.push("/history");
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

  const heightForRank = (rank: number) => {
    const score = groups[rank]?.[0]?.score ?? 0;
    const min = 72;
    const max = 220;
    if (topScore <= 0) return min;
    const fraction = Math.max(0, Math.min(1, score / topScore));
    return Math.round(min + (max - min) * fraction);
  };

  const colorForRank = (rank: number) =>
    rank === 1 ? "bg-accent" : rank === 2 ? "bg-muted" : "bg-secondary";

  if (bootstrap.status === "loading") {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="mx-auto h-12 w-64 animate-pulse rounded bg-muted" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <header className="mx-auto mb-8 max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => router.push("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbake til brettet
          </Button>

          {hasTeams && activeRunId ? (
            <Button onClick={() => setConfirmOpen(true)} disabled={isCompleting}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {isCompleting ? "Fullfører…" : "Fullfør og lagre økten"}
            </Button>
          ) : (
            hasTeams && (
              <span className="text-sm text-muted-foreground">
                Ingen aktiv økt å lagre
              </span>
            )
          )}
        </div>

        <div className="text-center">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">
            {quizTitle || "Uten navn"}
          </p>
          <h1 className="display-xl text-accent drop-shadow-sm">RESULTATER</h1>
          {total > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {answered} av {total} spørsmål spilt
            </p>
          )}
        </div>
      </header>

      {!hasTeams ? (
        <p className="text-center text-muted-foreground">
          Ingen lag enda — legg dem til i oppsettet.
        </p>
      ) : (
        <>
          <section className="mb-10 text-center">
            {groups[1]?.length ? (
              <>
                <div className="mb-3 flex items-center justify-center gap-3">
                  <Crown className="h-10 w-10 text-accent" />
                  <h2 className="text-2xl font-semibold sm:text-3xl">
                    {groups[1].length > 1 ? "Vinnere (uavgjort)" : "Vinner"}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {groups[1].map((team) => (
                    <span
                      key={team.id}
                      className="inline-flex items-center rounded-full border border-border bg-popover px-3 py-1.5 text-sm"
                    >
                      {team.name}
                      <span className="ml-2 font-bold text-accent">
                        {team.score} p
                      </span>
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          <section className="mb-14">
            <div className="mx-auto flex w-full max-w-4xl items-end justify-center gap-3">
              {ranksToShow.map((rank) => (
                <div
                  key={`rank-${rank}`}
                  className={`flex flex-col items-center ${
                    rank === 1 ? "order-2" : rank === 2 ? "order-1" : "order-3"
                  }`}
                >
                  <div className="z-10 mb-3 text-center">
                    <p className="text-3xl font-bold sm:text-4xl">{rank}</p>
                    <div className="mt-1 flex max-w-[10rem] flex-wrap justify-center gap-1.5 sm:max-w-[14rem]">
                      {groups[rank].map((team) => (
                        <span
                          key={team.id}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-popover px-2.5 py-1 text-xs"
                        >
                          <span className="max-w-[7rem] truncate">
                            {team.name}
                          </span>
                          <span className="font-bold text-accent tabular-nums">
                            {team.score}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div
                    className={`w-24 rounded-t-xl border border-border shadow-2xl sm:w-40 ${colorForRank(
                      rank
                    )}`}
                    style={{ height: heightForRank(rank) }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Crown className="h-4 w-4 text-accent" /> 1.
              </span>
              <span className="inline-flex items-center gap-1">
                <Medal className="h-4 w-4 text-muted-foreground" /> 2.
              </span>
              <span className="inline-flex items-center gap-1">
                <Medal className="h-4 w-4 text-secondary" /> 3.
              </span>
            </div>
          </section>

          <section className="mx-auto max-w-3xl">
            <h3 className="mb-4 text-center text-xl font-semibold">
              Full stilling
            </h3>
            <ol className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
              {ranked.map((team) => (
                <li
                  key={team.id}
                  className="flex items-center justify-between gap-3 bg-popover/40 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={[
                        "w-9 shrink-0 text-center text-lg font-bold tabular-nums",
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
                      <p className="truncate font-medium">{team.name}</p>
                      {team.players.length > 0 && (
                        <p className="truncate text-xs text-muted-foreground">
                          {team.players.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-accent">
                    {team.score} p
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

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
