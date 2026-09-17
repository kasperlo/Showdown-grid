"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Clock, Target, Trophy } from "lucide-react";
import { useQuizRun } from "@/hooks/queries/useQuizRuns";
import { formatDuration, formatRunDate } from "@/utils/format";
import type { AdjustmentEntry, CategorySummary } from "@/utils/types";

export default function RunDetailPage() {
  const router = useRouter();
  const params = useParams();
  const runId = typeof params.id === "string" ? params.id : null;
  const { data: run, isLoading, isError } = useQuizRun(runId);

  if (isLoading) {
    return (
      <main className="stage min-h-screen">
        <div className="container mx-auto max-w-4xl space-y-4 p-8">
          <div className="h-10 w-1/3 animate-pulse rounded bg-muted" />
          <div className="grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (isError || !run) {
    return (
      <main className="stage min-h-screen">
        <div className="container mx-auto p-8 text-center">
          <p className="text-muted-foreground">Fant ikke økten</p>
          <Button className="mt-4" onClick={() => router.push("/history")}>
            Tilbake til historikk
          </Button>
        </div>
      </main>
    );
  }

  const teams = [...(run.team_results ?? [])].sort((a, b) => a.rank - b.rank);
  const categorySummary = readCategorySummary(run.final_state);
  const adjustments = readAdjustments(run.final_state);
  const isLive = run.ended_at === null;

  return (
    <main className="stage min-h-screen">
      <div className="container mx-auto max-w-4xl p-4 md:p-8">
        <header className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/history")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbake til historikk
          </Button>
          <h1 className="display-xl mb-2 text-accent">{run.quiz_title}</h1>
          <p className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            {isLive
              ? "Økten pågår fortsatt"
              : formatRunDate(run.ended_at)}
          </p>
        </header>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat
            icon={<Clock className="mx-auto mb-2 h-7 w-7 text-accent" />}
            label="Varighet"
            value={formatDuration(run.duration_seconds)}
          />
          <Stat
            icon={<Target className="mx-auto mb-2 h-7 w-7 text-accent" />}
            label="Spørsmål"
            value={`${run.answered_questions}/${run.total_questions}`}
          />
          <Stat
            icon={<CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-accent" />}
            label="Fullført"
            value={`${run.completion_percentage}%`}
          />
          <Stat
            icon={<Trophy className="mx-auto mb-2 h-7 w-7 text-accent" />}
            label="Kategorier"
            value={String(categorySummary.length)}
          />
        </div>

        <section className="glass mb-8 rounded-2xl p-4 sm:p-6">
          <h2 className="mb-6 text-2xl font-bold text-accent">
            Sluttresultater
          </h2>
          {teams.length === 0 ? (
            <p className="text-muted-foreground">
              Ingen lagresultater ble lagret for denne økten.
            </p>
          ) : (
            <ol className="space-y-3">
              {teams.map((team) => (
                <li
                  key={team.teamId}
                  className="tile flex items-center justify-between gap-3 p-4"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xl font-bold text-accent tabular-nums">
                      {team.rank}
                    </span>
                    <p className="truncate text-lg font-semibold">
                      {team.teamName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-2xl font-bold text-accent tabular-nums sm:text-3xl">
                      {team.finalScore}
                    </span>
                    {team.rank === 1 && (
                      <Trophy className="h-7 w-7 text-accent" />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {categorySummary.length > 0 && (
          <section className="glass rounded-2xl p-4 sm:p-6">
            <h2 className="mb-6 text-2xl font-bold text-accent">Kategorier</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categorySummary.map((category, index) => {
                const percentage =
                  category.total > 0
                    ? Math.round((category.answered / category.total) * 100)
                    : 0;
                return (
                  <div key={`${category.name}-${index}`} className="tile p-4">
                    <h3 className="mb-3 truncate text-lg font-semibold">
                      {category.name}
                    </h3>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Besvart</span>
                      <span className="font-semibold tabular-nums">
                        {category.answered}/{category.total}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-accent transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {adjustments.length > 0 && (
          <section className="glass mt-8 rounded-2xl p-4 sm:p-6">
            <h2 className="mb-6 text-2xl font-bold text-accent">
              Manuelle justeringer
            </h2>
            <ul className="space-y-2">
              {adjustments.map((entry) => (
                <li
                  key={entry.id}
                  className="tile flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                >
                  <span className="text-muted-foreground">
                    {entry.teamNameSnapshot}
                  </span>
                  <div className="flex items-center gap-4">
                    {entry.reason && (
                      <span className="italic text-muted-foreground">
                        {entry.reason}
                      </span>
                    )}
                    <span
                      className={`font-bold tabular-nums ${
                        entry.delta > 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {entry.delta > 0 ? "+" : ""}
                      {entry.delta}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="tile p-4 text-center sm:p-6">
      {icon}
      <p className="mb-1 text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-accent sm:text-2xl">{value}</p>
    </div>
  );
}

/**
 * Completed runs carry a frozen `categorySummary`. Runs from before the
 * template/live split stored the whole board, so that shape is summarised on
 * the fly instead of showing nothing.
 */
function readCategorySummary(finalState: unknown): CategorySummary[] {
  if (!finalState || typeof finalState !== "object") return [];
  const raw = finalState as Record<string, unknown>;

  if (Array.isArray(raw.categorySummary)) {
    return raw.categorySummary as CategorySummary[];
  }

  if (Array.isArray(raw.categories)) {
    return (
      raw.categories as {
        name?: string;
        questions?: { answered?: boolean }[];
      }[]
    ).map((category) => ({
      name: String(category?.name ?? "Uten navn"),
      total: category?.questions?.length ?? 0,
      answered: (category?.questions ?? []).filter((q) => q?.answered).length,
    }));
  }

  return [];
}

function readAdjustments(finalState: unknown): AdjustmentEntry[] {
  if (!finalState || typeof finalState !== "object") return [];
  const raw = finalState as Record<string, unknown>;
  return Array.isArray(raw.adjustmentLog)
    ? (raw.adjustmentLog as AdjustmentEntry[])
    : [];
}
