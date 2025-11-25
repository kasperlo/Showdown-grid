"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Trophy, Trash2 } from "lucide-react";
import type { QuizRunSummary } from "@/utils/types";

export default function HistoryPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<QuizRunSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    try {
      const response = await fetch("/api/quiz-runs?limit=50");
      if (!response.ok) throw new Error("Failed to load runs");

      const { runs: data } = await response.json();
      setRuns(data);
    } catch (error) {
      console.error("Error loading runs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (runId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!confirm("Er du sikker på at du vil slette denne økten?")) {
      return;
    }

    try {
      const response = await fetch(`/api/quiz-runs/${runId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete run");

      // Reload list
      loadRuns();
    } catch (error) {
      console.error("Error deleting run:", error);
      alert("Kunne ikke slette økten");
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("no-NO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <main className="stage min-h-screen">
        <div className="container mx-auto p-8">
          <p className="text-center text-muted-foreground">Laster historikk...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="stage min-h-screen">
      <div className="container mx-auto p-4 md:p-8">
        <header className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbake
          </Button>
          <h1 className="display-xl text-accent">Quiz-historikk</h1>
          <p className="mt-2 text-muted-foreground">
            Se tilbake på tidligere quiz-økter
          </p>
        </header>

        {runs.length === 0 ? (
          <div className="text-center p-12 glass rounded-2xl">
            <Trophy className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">
              Ingen lagrede quiz-økter ennå
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Fullføre en quiz og lagre resultatet for å se historikk her!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {runs.map((run) => (
              <div
                key={run.id}
                className="tile p-6 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/history/${run.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-1">{run.quiz_title}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {formatDate(run.ended_at)}
                    </p>
                  </div>

                  <div className="text-right">
                    {run.winning_team_name && (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 justify-end">
                          <Trophy className="h-5 w-5 text-accent" />
                          <p className="text-xl font-bold text-accent">
                            {run.winning_team_name}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {run.winning_score} poeng
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <span>
                      {run.answered_questions}/{run.total_questions} spørsmål
                    </span>
                    <span>{run.completion_percentage}% fullført</span>
                    <span>{formatDuration(run.duration_seconds)}</span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDelete(run.id, e)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
