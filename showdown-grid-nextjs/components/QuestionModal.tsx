import React, { useEffect, useState, useRef, useMemo } from "react";
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
    // Reset revealed state when question changes
    setRevealed(false);

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

    // Handle joker countdown
    if (isQuestionOpen && lastQuestion?.isJoker) {
      setCountdown(10);

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
      setCountdown(null);
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
          setRevealed(false); // sikkerhetsnett ved lukking
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
          // JOKER VIEW
          <div className="flex-grow flex flex-col items-center justify-center text-center p-6 space-y-6">
            <div className="text-8xl md:text-9xl font-bold text-destructive animate-ping-short">
              {countdown}
            </div>
            <p className="text-2xl md:text-4xl font-semibold leading-tight pt-4">
              {lastQuestion.jokerTask}
            </p>
            {lastQuestion.imageUrl && (
              <img
                src={lastQuestion.imageUrl}
                alt="Joker-oppgave"
                className="max-w-full max-h-80 object-contain rounded-lg shadow-lg"
                loading="eager"
              />
            )}
          </div>
        ) : (
          // STANDARD VIEW
          <div className="flex-grow flex flex-col items-center justify-center text-center p-6 space-y-6">
            {isJokerActive && (
              <p className="text-2xl font-bold text-destructive">
                TIDEN ER UTE!
              </p>
            )}
            <p className="text-2xl md:text-4xl font-semibold leading-tight">
              {lastQuestion.question}
            </p>

            {lastQuestion.imageUrl && !isJokerActive && (
              <img
                src={lastQuestion.imageUrl}
                alt="Illustrasjon"
                className="max-w-full max-h-80 object-contain rounded-lg shadow-lg"
                loading="eager"
              />
            )}

            {revealed && (
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
