import React, { useEffect, useState } from "react";
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
  const { lastQuestion, isQuestionOpen, setQuestionOpen, endRound, quizTimeLimit } = useGameStore();
  const [revealed, setRevealed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isJokerActive, setIsJokerActive] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);

  useEffect(() => {
    if (isQuestionOpen && lastQuestion?.isJoker) {
      setIsJokerActive(true);
      setCountdown(10);
      setRevealed(false); // Sørg for at svaret er skjult

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(timer);
        setIsJokerActive(false);
        setCountdown(null);
      };
    } else {
      setIsJokerActive(false);
      setCountdown(null);
    }
  }, [isQuestionOpen, lastQuestion]);

  // BUGFIX #2: hver gang aktivt spørsmål byttes, nullstill "vis svar"
  useEffect(() => {
    // Avhengigheter: identiteten til ruten
    setRevealed(false);
  }, [lastQuestion?.categoryName, lastQuestion?.questionIndex]);

  // Timer activation
  useEffect(() => {
    if (isQuestionOpen && quizTimeLimit && !lastQuestion?.isJoker) {
      setIsTimerActive(true);
    } else {
      setIsTimerActive(false);
    }
  }, [isQuestionOpen, quizTimeLimit, lastQuestion?.isJoker]);

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
            {isJokerActive && <p className="text-2xl font-bold text-destructive">TIDEN ER UTE!</p>}
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
