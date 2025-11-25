"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, Clock, CheckCircle2, Target } from "lucide-react";
import type { QuizRun } from "@/utils/types";

export default function RunDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [run, setRun] = useState<QuizRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRun();
  }, [params.id]);

  const loadRun = async () => {
    try {
      const response = await fetch(`/api/quiz-runs/${params.id}`);
      if (!response.ok) throw new Error("Failed to load run");

      const { run: data } = await response.json();
      setRun(data);
    } catch (error) {
      console.error("Error loading run:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min ${secs} sek`;
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
          <p className="text-center text-muted-foreground">Laster...</p>
        </div>
      </main>
    );
  }

  if (!run) {
    return (
      <main className="stage min-h-screen">
        <div className="container mx-auto p-8">
          <p className="text-center text-muted-foreground">
            Fant ikke quiz-økten
          </p>
          <div className="text-center mt-4">
            <Button onClick={() => router.push("/history")}>
              Tilbake til historikk
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const sortedTeams = [...run.team_results].sort((a, b) => a.rank - b.rank);

  return (
    <main className="stage min-h-screen">
      <div className="container mx-auto p-4 md:p-8">
        <header className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/history")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbake til historikk
          </Button>
          <h1 className="display-xl text-accent mb-2">{run.quiz_title}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {formatDate(run.ended_at)}
          </p>
        </header>

        {/* Statistikk-oversikt */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="tile p-6 text-center">
            <Clock className="mx-auto h-8 w-8 text-accent mb-2" />
            <p className="text-sm text-muted-foreground mb-1">Varighet</p>
            <p className="text-2xl font-bold text-accent">
              {formatDuration(run.duration_seconds)}
            </p>
          </div>

          <div className="tile p-6 text-center">
            <Target className="mx-auto h-8 w-8 text-accent mb-2" />
            <p className="text-sm text-muted-foreground mb-1">Spørsmål</p>
            <p className="text-2xl font-bold text-accent">
              {run.answered_questions}/{run.total_questions}
            </p>
          </div>

          <div className="tile p-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-accent mb-2" />
            <p className="text-sm text-muted-foreground mb-1">Fullført</p>
            <p className="text-2xl font-bold text-accent">
              {run.completion_percentage}%
            </p>
          </div>

          <div className="tile p-6 text-center">
            <Trophy className="mx-auto h-8 w-8 text-accent mb-2" />
            <p className="text-sm text-muted-foreground mb-1">Kategorier</p>
            <p className="text-2xl font-bold text-accent">
              {run.final_state.categories.length}
            </p>
          </div>
        </div>

        {/* Team-resultater */}
        <div className="glass rounded-2xl p-6 mb-8">
          <h2 className="text-2xl font-bold text-accent mb-6">
            Sluttresultater
          </h2>
          <div className="space-y-4">
            {sortedTeams.map((team) => (
              <div
                key={team.teamId}
                className="tile p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/20">
                    <span className="text-2xl font-bold text-accent">
                      {team.rank}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{team.teamName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-bold text-accent">
                    {team.finalScore}
                  </span>
                  {team.rank === 1 && (
                    <Trophy className="h-8 w-8 text-accent" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kategori-oversikt */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-accent mb-6">Kategorier</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {run.final_state.categories.map((category, index) => {
              const answered = category.questions.filter(
                (q) => q.answered
              ).length;
              const total = category.questions.length;
              const percentage = Math.round((answered / total) * 100);

              return (
                <div key={index} className="tile p-4">
                  <h3 className="font-semibold mb-3 text-lg">
                    {category.name}
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Besvart</span>
                      <span className="font-semibold">
                        {answered}/{total}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-accent rounded-full h-2 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Manuelle justeringer (hvis det finnes noen) */}
        {run.final_state.adjustmentLog &&
          run.final_state.adjustmentLog.length > 0 && (
            <div className="glass rounded-2xl p-6 mt-8">
              <h2 className="text-2xl font-bold text-accent mb-6">
                Manuelle justeringer
              </h2>
              <div className="space-y-2">
                {run.final_state.adjustmentLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="tile p-3 flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {entry.teamNameSnapshot}
                    </span>
                    <div className="flex items-center gap-4">
                      {entry.reason && (
                        <span className="text-muted-foreground italic">
                          {entry.reason}
                        </span>
                      )}
                      <span
                        className={`font-bold ${
                          entry.delta > 0 ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {entry.delta > 0 ? "+" : ""}
                        {entry.delta}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </main>
  );
}
