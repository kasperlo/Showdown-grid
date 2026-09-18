"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { History, Library, Minimize2, Tv, Trophy } from "lucide-react";
import { useGameStore } from "@/utils/store";
import { UserMenu } from "@/components/UserMenu";
import { SaveIndicator } from "@/components/SaveIndicator";
import { EditModeToggle } from "@/components/editor/EditModeToggle";
import { countQuestions } from "@/utils/quiz-template";
import type { PresentationMode } from "@/hooks/usePresentationMode";

/**
 * One row, then a hairline of progress.
 *
 * The old header was 204px tall on a projector — a title at clamp(…, 5rem), a
 * progress bar with its own label, and a turn indicator on a line of its own.
 * All of it was height the board did not get, for information the room reads
 * once. The title shrank, the progress became the 3px line under the bar, and
 * the turn moved onto the row.
 */
export function GameTopBar({
  presentation,
}: {
  presentation: PresentationMode;
}) {
  const router = useRouter();
  const categories = useGameStore((s) => s.categories);
  const quizTitle = useGameStore((s) => s.quizTitle);
  const quizDescription = useGameStore((s) => s.quizDescription);
  const isPublicPlay = useGameStore((s) => s.isPlayingPublicQuiz);

  const total = countQuestions(categories);
  const answered = categories.reduce(
    (sum, c) => sum + c.questions.filter((q) => q.answered).length,
    0,
  );
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <header className="shrink-0">
      <div className="flex items-center gap-2 px-3 py-2 sm:px-6">
        {!presentation.active && (
          <div className="flex shrink-0 items-center gap-1">
            {/* Hidden below sm, where the bar has no room for them. Both are
                also in the account menu, which never goes away. */}
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => router.push("/quizzes")}
              title="Biblioteket"
              aria-label="Biblioteket"
            >
              <Library className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => router.push("/history")}
              title="Historikk"
              aria-label="Historikk"
            >
              <History className="h-4 w-4" />
            </Button>
            <EditModeToggle />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-[clamp(1rem,3vh,2.1rem)] font-extrabold leading-none tracking-tight text-accent drop-shadow-sm"
            title={quizTitle || "Uten navn"}
          >
            {quizTitle || "Uten navn"}
          </h1>
          {quizDescription && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {quizDescription}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {presentation.active ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={presentation.exit}
              className="gap-2"
              title="Tilbake til vertens visning"
            >
              <Minimize2 className="h-4 w-4" />
              <span className="hidden sm:inline">Avslutt</span>
            </Button>
          ) : (
            <>
              <SaveIndicator className="hidden lg:inline-flex" />
              <Button
                variant="ghost"
                size="sm"
                onClick={presentation.enter}
                className="hidden gap-2 sm:inline-flex"
                title="Fullskjerm uten verktøylinje — for projektoren"
              >
                <Tv className="h-4 w-4" />
                <span className="hidden sm:inline">Salen</span>
              </Button>
              <Button
                onClick={() => router.push("/results")}
                size="sm"
                className="gap-2 bg-accent font-bold text-accent-foreground"
                title="Sluttresultater"
              >
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">Resultater</span>
              </Button>
              <UserMenu />
            </>
          )}
        </div>
      </div>

      <div
        className="h-[3px] w-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${answered} av ${total} spørsmål spilt`}
        title={`${answered}/${total} spilt`}
      >
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      {isPublicPlay && !presentation.active && (
        <p className="px-3 pt-1 text-center text-xs text-muted-foreground sm:px-6">
          Offentlig quiz — poengene havner i din historikk, quizen endres ikke.
        </p>
      )}
    </header>
  );
}
