"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { History, Library, Settings, Trophy } from "lucide-react";
import { useGameStore } from "@/utils/store";
import { UserMenu } from "@/components/UserMenu";
import { SaveIndicator } from "@/components/SaveIndicator";
import { countQuestions } from "@/utils/quiz-template";

interface GameHeaderProps {
  userEmail?: string;
  isAnonymous: boolean;
}

/**
 * One row of controls at the top instead of icons absolutely positioned over
 * the title, which collided with long quiz names on anything narrower than a
 * laptop.
 */
export function GameHeader({ userEmail, isAnonymous }: GameHeaderProps) {
  const router = useRouter();
  const quizTitle = useGameStore((s) => s.quizTitle);
  const quizDescription = useGameStore((s) => s.quizDescription);
  const categories = useGameStore((s) => s.categories);
  const canEdit = useGameStore((s) => s.canEditActiveQuiz());
  const isPublicPlay = useGameStore((s) => s.isPlayingPublicQuiz);

  const total = countQuestions(categories);
  const answered = categories.reduce(
    (sum, c) => sum + c.questions.filter((q) => q.answered).length,
    0
  );
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <header className="mb-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/quizzes")}
            className="gap-2"
          >
            <Library className="h-4 w-4" />
            <span className="hidden sm:inline">Bibliotek</span>
          </Button>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/setup")}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Rediger</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/history")}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Historikk</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <SaveIndicator className="hidden sm:inline-flex" />
          <Button
            onClick={() => router.push("/results")}
            size="sm"
            className="gap-2 bg-accent font-bold text-accent-foreground"
          >
            <Trophy className="h-4 w-4" />
            Resultater
          </Button>
          <UserMenu userEmail={userEmail} isAnonymous={isAnonymous} />
        </div>
      </div>

      <div className="text-center">
        <h1 className="display-xl break-words text-accent drop-shadow-sm">
          {quizTitle || "Uten navn"}
        </h1>
        {quizDescription && (
          <p className="mt-2 text-base text-muted-foreground sm:text-lg">
            {quizDescription}
          </p>
        )}

        <div className="mx-auto mt-4 flex max-w-sm items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Andel spørsmål spilt"
          >
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {answered}/{total} spilt
          </span>
        </div>

        {isPublicPlay && (
          <p className="mt-3 text-xs text-muted-foreground">
            Du spiller en offentlig quiz. Poengene lagres i historikken din, men
            quizen endres ikke.
          </p>
        )}
      </div>
    </header>
  );
}
