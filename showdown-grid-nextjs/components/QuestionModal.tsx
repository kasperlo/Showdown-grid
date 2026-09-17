"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGameStore } from "@/utils/store";
import { Timer } from "@/components/Timer";

/**
 * Shows the question, then the answer. Points are handed out in RoundDock after
 * this closes.
 */
export function QuestionModal() {
  const lastQuestion = useGameStore((state) => state.lastQuestion);
  const key = lastQuestion
    ? `${lastQuestion.categoryName}-${lastQuestion.questionIndex}`
    : "no-question";

  // Remounting per question resets "revealed" and the countdown without an
  // effect that has to undo the previous question's state.
  return <QuestionModalContent key={key} />;
}

function QuestionModalContent() {
  const lastQuestion = useGameStore((state) => state.lastQuestion);
  const isQuestionOpen = useGameStore((state) => state.isQuestionOpen);
  const setQuestionOpen = useGameStore((state) => state.setQuestionOpen);
  const endRound = useGameStore((state) => state.endRound);
  const quizTimeLimit = useGameStore((state) => state.quizTimeLimit);
  const jokerTimeLimit = useGameStore((state) => state.jokerTimeLimit);
  const activeRunId = useGameStore((state) => state.activeRunId);
  const startSession = useGameStore((state) => state.startSession);

  const isJoker = Boolean(lastQuestion?.isJoker);
  const hasCode = Boolean(lastQuestion?.code?.trim());

  const [revealed, setRevealed] = useState(false);
  // Seeded at mount instead of in an effect. This component is keyed per
  // question, so a new question mounts a fresh countdown by itself.
  const [countdown, setCountdown] = useState<number | null>(() =>
    isJoker ? lastQuestion?.jokerTimer || jokerTimeLimit || 10 : null,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jokerRunning = isJoker && countdown !== null && countdown > 0;
  const jokerFinished = isJoker && countdown === 0;
  const isTimerActive = Boolean(isQuestionOpen && quizTimeLimit && !isJoker);

  // The first opened question starts the session that holds the live state.
  // startSession() is idempotent on both sides; before it was, two of these
  // fired and created two sessions.
  useEffect(() => {
    if (!isQuestionOpen || activeRunId) return;
    void startSession();
  }, [isQuestionOpen, activeRunId, startSession]);

  useEffect(() => {
    if (!isQuestionOpen || !isJoker) return;

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isQuestionOpen, isJoker]);

  if (!lastQuestion) return null;

  return (
    <Dialog open={isQuestionOpen} onOpenChange={setQuestionOpen}>
      <DialogContent className="flex h-[94vh] w-full max-w-[min(96vw,90rem)] flex-col border-accent bg-popover text-foreground">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-left text-[clamp(1.1rem,3.2vh,2.4rem)] font-extrabold tracking-tight text-accent">
              {lastQuestion.categoryName} • {lastQuestion.points}
            </DialogTitle>
            {isTimerActive && quizTimeLimit && (
              <Timer initialTime={quizTimeLimit} className="shrink-0" />
            )}
          </div>
          <DialogDescription className="sr-only">
            Vis svaret ved behov. Lukk for å tildele poeng i dokken nederst.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto p-2 text-center sm:p-6">
          {jokerRunning ? (
            <div className="flex w-full max-w-5xl flex-col items-center gap-6">
              <div className="rounded-full bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 px-4 py-2 text-base font-black tracking-wider text-white shadow-lg">
                JOKER
              </div>
              <p className="px-2 text-[clamp(1.4rem,5.6vh,4rem)] font-bold leading-tight">
                {lastQuestion.jokerTask}
              </p>
              <div className="bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 bg-clip-text text-6xl font-black tabular-nums text-transparent drop-shadow-lg sm:text-8xl">
                {countdown}
              </div>
            </div>
          ) : (
            <>
              {jokerFinished && (
                <div className="flex w-full max-w-5xl flex-col items-center gap-4">
                  <p className="bg-gradient-to-r from-red-500 via-orange-500 to-red-600 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
                    TIDEN ER UTE!
                  </p>
                  <p className="px-2 text-[clamp(1.1rem,3.4vh,2.2rem)] font-semibold leading-tight text-muted-foreground">
                    {lastQuestion.jokerTask}
                  </p>
                </div>
              )}

              {!isJoker && (lastQuestion.question.trim() || !hasCode) && (
                <p className="px-2 text-[clamp(1.35rem,5.4vh,4.2rem)] font-semibold leading-tight">
                  {lastQuestion.question || "(Ingen spørsmålstekst)"}
                </p>
              )}

              {hasCode && !isJoker && (
                /* Left-aligned inside a centred column, because code read
                   centre-aligned is unreadable. Sized to be legible from the
                   back of the room, and it scrolls rather than wraps: a wrapped
                   line changes what the snippet means. */
                <pre className="max-h-[52vh] w-full max-w-6xl overflow-auto rounded-lg border border-border bg-background/80 px-4 py-3 text-left font-mono text-[clamp(0.95rem,3.1vh,2.1rem)] leading-relaxed">
                  <code>{lastQuestion.code}</code>
                </pre>
              )}

              {lastQuestion.imageUrl && !isJoker && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lastQuestion.imageUrl}
                  alt="Illustrasjon til spørsmålet"
                  className="max-h-[56vh] max-w-full rounded-lg object-contain shadow-lg"
                  loading="eager"
                />
              )}

              {revealed && !isJoker && (
                <div className="flex w-full max-w-5xl flex-col gap-3">
                <div className="w-full rounded-lg border border-border bg-muted p-4">
                  {/* The answer to a code card is usually code itself —
                      `"object"`, `[1, NaN, NaN]` — and the quotes and brackets
                      have to survive. */}
                  <p
                    className={
                      hasCode
                        ? "whitespace-pre-wrap break-words font-mono text-[clamp(1.2rem,4.4vh,3.2rem)] font-bold text-accent"
                        : "text-[clamp(1.5rem,6.2vh,4.5rem)] font-extrabold tracking-tight text-accent"
                    }
                  >
                    {lastQuestion.answer || "(Ingen svartekst)"}
                  </p>
                </div>

                {lastQuestion.explanation?.trim() && (
                  /* Smaller than the answer on purpose: the answer is what the
                     room shouts, this is what the host reads out after. */
                  <p className="whitespace-pre-wrap px-2 text-center text-[clamp(0.95rem,2.6vh,1.7rem)] leading-snug text-muted-foreground">
                    {lastQuestion.explanation}
                  </p>
                )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="mt-auto border-t border-border p-3 sm:p-4">
          {isJoker ? (
            <div className="flex w-full gap-2">
              <Button
                onClick={() => setQuestionOpen(false)}
                className="flex-1 bg-primary py-5 text-base text-primary-foreground hover:bg-primary/90"
              >
                Til poengtildeling
              </Button>
              <Button
                onClick={() => endRound()}
                variant="secondary"
                className="flex-1"
              >
                Avslutt runden
              </Button>
            </div>
          ) : !revealed ? (
            <Button
              onClick={() => setRevealed(true)}
              className="w-full bg-success py-6 text-lg text-success-foreground hover:bg-success/90"
            >
              Vis svar
            </Button>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => setRevealed(false)}
                variant="secondary"
                className="sm:flex-1"
              >
                Skjul svar
              </Button>
              <Button
                onClick={() => setQuestionOpen(false)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 sm:flex-[2]"
              >
                Til poengtildeling
              </Button>
              <Button
                onClick={() => endRound()}
                variant="ghost"
                className="sm:flex-1"
              >
                Avslutt runden
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
