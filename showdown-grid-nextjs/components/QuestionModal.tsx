import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useGameStore } from "@/utils/store";
import { Timer } from "@/components/Timer";

/**
 * Modal viser spørsmål/svar.
 * Poengtildeling skjer i RoundDock ETTER at denne lukkes.
 */
export function QuestionModal() {
  const lastQuestion = useGameStore((state) => state.lastQuestion);
  const isQuestionOpen = useGameStore((state) => state.isQuestionOpen);
  const setQuestionOpen = useGameStore((state) => state.setQuestionOpen);
  const endRound = useGameStore((state) => state.endRound);
  const quizTimeLimit = useGameStore((state) => state.quizTimeLimit);
  const currentRunStartTime = useGameStore((state) => state.currentRunStartTime);
  const setRunStartTime = useGameStore((state) => state.setRunStartTime);
  const activeRunId = useGameStore((state) => state.activeRunId);
  const startSession = useGameStore((state) => state.startSession);

  // Create a unique key for the question to reset component state when question changes
  const questionKey = lastQuestion
    ? `${lastQuestion.categoryName}-${lastQuestion.questionIndex}`
    : 'no-question';

  return <QuestionModalContent key={questionKey} />;
}

function QuestionModalContent() {
  const lastQuestion = useGameStore((state) => state.lastQuestion);
  const isQuestionOpen = useGameStore((state) => state.isQuestionOpen);
  const setQuestionOpen = useGameStore((state) => state.setQuestionOpen);
  const endRound = useGameStore((state) => state.endRound);
  const quizTimeLimit = useGameStore((state) => state.quizTimeLimit);
  const jokerTimeLimit = useGameStore((state) => state.jokerTimeLimit);
  const currentRunStartTime = useGameStore((state) => state.currentRunStartTime);
  const setRunStartTime = useGameStore((state) => state.setRunStartTime);
  const activeRunId = useGameStore((state) => state.activeRunId);
  const startSession = useGameStore((state) => state.startSession);

  const [revealed, setRevealed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Derived state: determine if joker is active
  const isJokerActive = Boolean(
    isQuestionOpen &&
      lastQuestion?.isJoker &&
      countdown !== null &&
      countdown > 0
  );

  // Derived state: determine if timer should be active
  const isTimerActive = Boolean(
    isQuestionOpen && quizTimeLimit && !lastQuestion?.isJoker
  );

  // Single consolidated effect for modal state management
  useEffect(() => {
    // Start quiz session when first question opens (if no active session exists)
    if (isQuestionOpen && !activeRunId) {
      startSession().then((runId) => {
        if (runId) {
          console.log("Session started automatically:", runId);
        }
      }).catch((error) => {
        console.error("Failed to start session:", error);
      });
    }
    // Note: If session exists (restored), currentRunStartTime is already set by restoreActiveSession()

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Handle joker countdown - initialize and start interval
    if (isQuestionOpen && lastQuestion?.isJoker) {
      // Use per-question timer, fallback to global, then default 10
      const jokerSeconds = lastQuestion.jokerTimer || jokerTimeLimit || 10;
      Promise.resolve().then(() => setCountdown(jokerSeconds));

      intervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      Promise.resolve().then(() => setCountdown(null));
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [
    isQuestionOpen,
    lastQuestion?.categoryName,
    lastQuestion?.questionIndex,
    lastQuestion?.isJoker,
    lastQuestion?.jokerTimer,
    jokerTimeLimit,
    currentRunStartTime,
    setRunStartTime,
    activeRunId,
    startSession,
  ]);

  const handleTimeUp = () => {
    // Optionally auto-reveal answer or just notify
    // For now, we'll just leave it as is
  };

  if (!lastQuestion) return null;

  return (
    <Dialog
      open={isQuestionOpen}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setQuestionOpen(false);
        } else {
          setQuestionOpen(true);
        }
      }}
    >
      <DialogContent className="bg-popover border-accent text-foreground max-w-4xl w-full h-auto md:h-3/4 flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="display-lg text-accent">
              {lastQuestion.categoryName} • {lastQuestion.points}
            </DialogTitle>
            {isTimerActive && quizTimeLimit && (
              <Timer
                initialTime={quizTimeLimit}
                onTimeUp={handleTimeUp}
                className="ml-4"
              />
            )}
          </div>
          <DialogDescription className="sr-only">
            Vis svaret ved behov. Lukk for å tildele poeng i dokken nederst.
          </DialogDescription>
        </DialogHeader>

        {isJokerActive && countdown !== null && countdown > 0 ? (
          // JOKER VIEW - Task in focus, badge in corner
          <div className="flex-grow flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-red-500/10 to-purple-500/10" />

            {/* JOKER badge - top-right corner with larger image */}
            <div className="absolute top-4 right-4 flex items-center gap-3 z-20">
              <div className="bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 text-white px-4 py-2 rounded-full text-base md:text-lg font-black tracking-wider shadow-lg">
                JOKER
              </div>
            </div>

            {/* Main content - Task in focus with timer */}
            <div className="relative z-10 flex flex-col items-center justify-center gap-6 max-w-3xl">
              {/* Task text - MAIN FOCUS */}
              <img
                src="/JOKER.jpg"
                alt="JOKER"
                className="w-[25%] h-[40%] object-cover rounded-xl border-3 border-yellow-400 shadow-xl"
              />
              <p className="text-3xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight px-4">
                {lastQuestion.jokerTask}
              </p>

              {/* Countdown - prominent but secondary */}
              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 drop-shadow-lg tabular-nums">
                  {countdown}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // STANDARD VIEW
          <div className="flex-grow flex flex-col items-center justify-center text-center p-6 space-y-6">
            {lastQuestion?.isJoker && countdown === 0 && (
              // JOKER - Time's up view - still show the task
              <div className="flex flex-col items-center gap-6 w-full max-w-3xl">
                {/* Time's up banner */}
                <div className="flex items-center gap-3 animate-pulse">
                  <div className="bg-gradient-to-r from-red-500 via-orange-500 to-red-500 text-white px-4 py-1.5 rounded-full text-sm font-black tracking-wider shadow-lg">
                    JOKER
                  </div>
                  <p className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-red-600">
                    TIDEN ER UTE!
                  </p>
                </div>
                {/* Still show the task for reference */}
                <p className="text-2xl md:text-3xl font-semibold text-muted-foreground leading-tight px-4">
                  {lastQuestion.jokerTask}
                </p>
              </div>
            )}

            {/* Hide question/answer for joker tasks - they only have jokerTask */}
            {!lastQuestion?.isJoker && (
              <p className="text-2xl md:text-4xl font-semibold leading-tight">
                {lastQuestion.question}
              </p>
            )}

            {lastQuestion.imageUrl && !isJokerActive && !lastQuestion?.isJoker && (
              <img
                src={lastQuestion.imageUrl}
                alt="Illustrasjon"
                className="max-w-full max-h-80 object-contain rounded-lg shadow-lg"
                loading="eager"
              />
            )}

            {revealed && !lastQuestion?.isJoker && (
              <div className="p-4 bg-muted rounded-lg border border-border">
                <p className="display-lg text-accent">{lastQuestion.answer}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="p-4 border-t border-border mt-auto">
          {!revealed ? (
            <Button
              onClick={() => setRevealed(true)}
              className="w-full text-lg py-6 bg-success text-success-foreground hover:bg-success/90"
            >
              Vis svar
            </Button>
          ) : (
            <div className="w-full flex gap-2">
              <Button
                onClick={() => setRevealed(false)}
                variant="secondary"
                className="flex-1"
              >
                Skjul
              </Button>
              <Button
                onClick={() => setQuestionOpen(false)}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Lukk
              </Button>
              <Button
                onClick={() => endRound()}
                variant="destructive"
                className="flex-1"
              >
                Avslutt runde
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
