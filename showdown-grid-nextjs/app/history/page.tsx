"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Trash2, Trophy } from "lucide-react";
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
import { useQuizRuns } from "@/hooks/queries/useQuizRuns";
import { useDeleteRun } from "@/hooks/mutations/useQuizRunMutations";
import { toast } from "@/hooks/use-toast";
import { formatRunDate, formatDuration } from "@/utils/format";

export default function HistoryPage() {
  const router = useRouter();
  const { data: runs = [], isLoading, isError } = useQuizRuns(undefined, 50);
  const deleteRun = useDeleteRun();
  const [runToDelete, setRunToDelete] = useState<string | null>(null);

  return (
    <main className="stage min-h-screen">
      <div className="container mx-auto max-w-3xl p-4 md:p-8">
        <header className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbake
          </Button>
          <h1 className="display-xl text-accent">Historikk</h1>
          <p className="mt-2 text-muted-foreground">
            Fullførte økter. En økt havner her når du trykker «Fullfør» på
            resultatsiden.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-muted-foreground">
              Kunne ikke laste historikken.
            </p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Prøv igjen
            </Button>
          </div>
        ) : runs.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Trophy className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">
              Ingen fullførte økter enda
            </p>
            <Button className="mt-4" onClick={() => router.push("/")}>
              Spill en runde
            </Button>
          </div>
        ) : (
          <ul className="space-y-4">
            {runs.map((run) => (
              <li key={run.id}>
                <div className="tile p-4 sm:p-6">
                  <button
                    type="button"
                    onClick={() => router.push(`/history/${run.id}`)}
                    className="w-full text-left"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold sm:text-xl">
                          {run.quiz_title}
                        </h2>
                        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {formatRunDate(run.ended_at ?? run.started_at ?? null)}
                        </p>
                      </div>

                      {run.winning_team_name && (
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Trophy className="h-5 w-5 text-accent" />
                            <p className="text-lg font-bold text-accent">
                              {run.winning_team_name}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {run.winning_score ?? 0} poeng
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {run.answered_questions}/{run.total_questions} spørsmål
                      </span>
                      <span>{run.completion_percentage}% fullført</span>
                      <span>{formatDuration(run.duration_seconds)}</span>
                    </div>
                  </button>

                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRunToDelete(run.id)}
                      className="text-destructive hover:text-destructive"
                      aria-label={`Slett økt: ${run.quiz_title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog
        open={!!runToDelete}
        onOpenChange={(open) => !open && setRunToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slette økten?</AlertDialogTitle>
            <AlertDialogDescription>
              Resultatet forsvinner fra historikken. Kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const target = runToDelete;
                setRunToDelete(null);
                if (!target) return;
                try {
                  await deleteRun.mutateAsync(target);
                  toast({ title: "Økten ble slettet" });
                } catch {
                  toast({
                    title: "Kunne ikke slette økten",
                    variant: "destructive",
                  });
                }
              }}
            >
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
