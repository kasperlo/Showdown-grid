"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Lightbulb, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Timer } from "@/components/Timer";
import { useGameStore } from "@/utils/store";

const EmojiBurst = dynamic(() => import("../EmojiBurst"), { ssr: false });

const POS_EMOJIS = ["🔥", "💥", "💣", "🤟", "😎", "🍻", "🍾"];
const NEG_EMOJIS = ["🤣", "😂", "💀", "⚰️", "🤡"];

function isTypingTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return Boolean(
    target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
  );
}

/**
 * A round, on the whole page. The board's own state lives in the store, so
 * it is safe for GameStage to unmount it for as long as this is up.
 *
 * Remounted (via the key GameStage gives it) whenever lastQuestion changes
 * identity — that resets every step's local state (the joker countdown, the
 * award step's points stepper) by construction, the same way QuestionModal
 * and RoundDock used to key themselves per question.
 */
export function RoundScreen() {
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  if (!lastQuestion) return null;
  return (
    <RoundScreenBody
      key={`${lastQuestion.categoryName}-${lastQuestion.questionIndex}`}
    />
  );
}

function RoundScreenBody() {
  const roundStep = useGameStore((s) => s.roundStep);
  const activeRunId = useGameStore((s) => s.activeRunId);
  const startSession = useGameStore((s) => s.startSession);
  const [showBurst, setShowBurst] = useState(false);
  const [burstEmojis, setBurstEmojis] = useState<string[]>(POS_EMOJIS);

  // The first opened question starts the session that holds the live
  // state. startSession() is idempotent on both sides.
  useEffect(() => {
    if (activeRunId) return;
    void startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fireBurst = useCallback((emojis: string[]) => {
    setBurstEmojis(emojis);
    setShowBurst(true);
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <EmojiBurst
        show={showBurst}
        emojis={burstEmojis}
        duration={1500}
        intensity={1.1}
        onComplete={() => setShowBurst(false)}
      />

      <div
        key={roundStep ?? "none"}
        className="round-step-fade flex min-h-0 flex-1 flex-col"
      >
        {roundStep === "question" && <QuestionStep />}
        {roundStep === "answer" && <AnswerStep />}
        {roundStep === "award" && <AwardStep onFireBurst={fireBurst} />}
        {roundStep === "awarded" && <AwardedStep />}
      </div>
    </div>
  );
}

/** Left-column recap shown beside the award and awarded steps. */
function QuestionAnswerRecap() {
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  if (!lastQuestion) return null;
  const hasCode = Boolean(lastQuestion.code?.trim());

  return (
    <aside className="w-[480px] shrink-0 overflow-y-auto border-r border-border p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {lastQuestion.categoryName} • {lastQuestion.points}
      </p>
      {lastQuestion.question.trim() && (
        <p className="mt-3 text-2xl font-semibold leading-snug">
          {lastQuestion.question}
        </p>
      )}
      {hasCode && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-border bg-background/80 px-3 py-2 text-left font-mono text-sm leading-relaxed">
          <code>{lastQuestion.code}</code>
        </pre>
      )}
      <p
        className={
          hasCode
            ? "mt-4 whitespace-pre-wrap break-words font-mono text-[2.875rem] font-bold text-accent"
            : "mt-4 text-[2.875rem] font-extrabold leading-tight text-accent"
        }
      >
        {lastQuestion.answer || "(Ingen svartekst)"}
      </p>
      {lastQuestion.explanation?.trim() && (
        <p className="mt-3 whitespace-pre-wrap text-[17px] leading-snug text-muted-foreground">
          {lastQuestion.explanation}
        </p>
      )}
    </aside>
  );
}

/** Read-only team+score strip for the bottom of the question step. */
function ThinStandingsLine() {
  const teams = useGameStore((s) => s.teams);
  const currentTurnTeamId = useGameStore((s) => s.currentTurnTeamId);
  if (!teams.length) return null;

  return (
    <div className="overflow-x-auto border-t border-border/60 px-3 py-1.5 sm:px-6">
      <div className="mx-auto flex items-center gap-2">
        {teams.map((team) => (
          <span
            key={team.id}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs sm:text-sm ${
              team.id === currentTurnTeamId ? "border-accent" : "border-border"
            }`}
          >
            <span className="max-w-[8rem] truncate font-medium">
              {team.name}
            </span>
            <span className="font-bold tabular-nums text-accent">
              {team.score}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function QuestionStep() {
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  const quizTimeLimit = useGameStore((s) => s.quizTimeLimit);
  const jokerTimeLimit = useGameStore((s) => s.jokerTimeLimit);
  const advanceRoundStep = useGameStore((s) => s.advanceRoundStep);
  const cancelRound = useGameStore((s) => s.cancelRound);

  const isJoker = Boolean(lastQuestion?.isJoker);
  const hasCode = Boolean(lastQuestion?.code?.trim());
  // Seeded at mount, not in an effect: this component remounts fresh on
  // every new question (see RoundScreen's key).
  const [countdown, setCountdown] = useState<number | null>(() =>
    isJoker ? lastQuestion?.jokerTimer || jokerTimeLimit || 10 : null
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jokerRunning = isJoker && countdown !== null && countdown > 0;
  const jokerFinished = isJoker && countdown === 0;
  const isTimerActive = Boolean(quizTimeLimit && !isJoker);

  useEffect(() => {
    if (!isJoker) return;
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
  }, [isJoker]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (useGameStore.getState().roundStep !== "question") return;
      if (isTypingTarget(event)) return;

      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        advanceRoundStep();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelRound();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advanceRoundStep, cancelRound]);

  if (!lastQuestion) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-8">
        <p className="text-left text-[clamp(1rem,2.8vh,1.8rem)] font-extrabold tracking-tight text-accent">
          {lastQuestion.categoryName} • {lastQuestion.points}
        </p>
        {isTimerActive && quizTimeLimit && (
          <Timer initialTime={quizTimeLimit} className="shrink-0" />
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto p-4 text-center sm:p-8">
        {jokerRunning ? (
          <div className="flex w-full max-w-5xl flex-col items-center gap-6">
            <div className="rounded-full bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 px-4 py-2 text-base font-black tracking-wider text-white shadow-lg">
              JOKER
            </div>
            <p className="px-2 text-[clamp(1.6rem,6.2vh,4.5rem)] font-bold leading-tight">
              {lastQuestion.jokerTask}
            </p>
            <div className="bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 bg-clip-text text-7xl font-black tabular-nums text-transparent drop-shadow-lg sm:text-9xl">
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
              <p className="px-2 text-[clamp(1.6rem,6vh,4.6rem)] font-semibold leading-tight">
                {lastQuestion.question || "(Ingen spørsmålstekst)"}
              </p>
            )}

            {hasCode && !isJoker && (
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
          </>
        )}
      </div>

      <ThinStandingsLine />

      <div className="border-t border-border p-3 sm:p-4">
        <Button
          onClick={advanceRoundStep}
          className="w-full bg-success py-6 text-lg text-success-foreground hover:bg-success/90"
        >
          {isJoker ? "Til poengtildeling" : "Vis svar"}
        </Button>
      </div>
    </div>
  );
}

function AnswerStep() {
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  const advanceRoundStep = useGameStore((s) => s.advanceRoundStep);
  const [explained, setExplained] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (useGameStore.getState().roundStep !== "answer") return;
      if (isTypingTarget(event)) return;

      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        advanceRoundStep();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advanceRoundStep]);

  if (!lastQuestion) return null;
  const hasCode = Boolean(lastQuestion.code?.trim());

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto p-4 text-center sm:p-8">
      <p className="text-[clamp(1rem,2.6vh,1.6rem)] font-semibold text-muted-foreground">
        {lastQuestion.categoryName} • {lastQuestion.points}
      </p>
      {lastQuestion.question.trim() && (
        <p className="px-2 text-[clamp(1rem,2.8vh,1.8rem)] font-medium text-muted-foreground">
          {lastQuestion.question}
        </p>
      )}
      {hasCode && (
        <pre className="max-h-[30vh] w-full max-w-6xl overflow-auto rounded-lg border border-border bg-background/80 px-4 py-3 text-left font-mono text-[clamp(0.9rem,2.6vh,1.5rem)] leading-relaxed">
          <code>{lastQuestion.code}</code>
        </pre>
      )}
      <div className="w-full max-w-5xl rounded-lg border border-border bg-muted p-4">
        <p
          className={
            hasCode
              ? "whitespace-pre-wrap break-words font-mono text-[clamp(1.4rem,6vh,4rem)] font-bold text-accent"
              : "text-[clamp(1.8rem,7.5vh,5.5rem)] font-extrabold tracking-tight text-accent"
          }
        >
          {lastQuestion.answer || "(Ingen svartekst)"}
        </p>
      </div>
      {lastQuestion.explanation?.trim() &&
        (explained ? (
          <p className="whitespace-pre-wrap px-2 text-[clamp(0.9rem,2.2vh,1.2rem)] leading-snug text-muted-foreground">
            {lastQuestion.explanation}
          </p>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExplained(true)}
            className="gap-2 text-muted-foreground"
          >
            <Lightbulb className="h-4 w-4" />
            Forklar
          </Button>
        ))}

      <Button
        onClick={advanceRoundStep}
        className="mt-auto w-full max-w-md bg-accent py-6 text-lg text-accent-foreground hover:bg-accent/90"
      >
        Tildel poeng
      </Button>
    </div>
  );
}

function AwardStep({
  onFireBurst,
}: {
  onFireBurst: (emojis: string[]) => void;
}) {
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  const teams = useGameStore((s) => s.teams);
  const round = useGameStore((s) => s.round);
  const awardPositive = useGameStore((s) => s.awardPositive);
  const awardNegative = useGameStore((s) => s.awardNegative);

  const [points, setPoints] = useState(() => lastQuestion?.points ?? 0);
  const [penaltyArmed, setPenaltyArmed] = useState(false);
  const penaltyAmount = lastQuestion
    ? Math.round(lastQuestion.points * 0.5)
    : 0;

  const handleCorrect = useCallback(
    (teamId: string) => {
      if (round.positiveTeamId) return;
      onFireBurst(POS_EMOJIS);
      // Let the canvas mount before the state change that re-renders this step.
      setTimeout(() => awardPositive(teamId, points), 0);
    },
    [round.positiveTeamId, onFireBurst, awardPositive, points]
  );

  const handlePenalty = useCallback(
    (teamId: string) => {
      if (round.positiveTeamId || round.negativeAwardedTo.includes(teamId))
        return;
      onFireBurst(NEG_EMOJIS);
      awardNegative(teamId);
    },
    [round.positiveTeamId, round.negativeAwardedTo, onFireBurst, awardNegative]
  );

  const handleTeamClick = (teamId: string) => {
    if (penaltyArmed) {
      handlePenalty(teamId);
      setPenaltyArmed(false);
    } else {
      handleCorrect(teamId);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (useGameStore.getState().roundStep !== "award") return;
      if (isTypingTarget(event)) return;

      const digitMatch = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
      if (digitMatch) {
        const index = Number(digitMatch[1]) - 1;
        const team = teams[index];
        if (!team) return;
        event.preventDefault();
        if (event.shiftKey || penaltyArmed) {
          handlePenalty(team.id);
          setPenaltyArmed(false);
        } else {
          handleCorrect(team.id);
        }
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        useGameStore.getState().endRound();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [teams, handleCorrect, handlePenalty, penaltyArmed]);

  if (!lastQuestion) return null;

  return (
    <div className="flex min-h-0 flex-1">
      <QuestionAnswerRecap />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <p className="text-[clamp(1.3rem,3.6vh,2.2rem)] font-bold">
          Hvem svarte riktig?
        </p>

        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-muted-foreground">
            Poeng
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setPoints((p) => Math.max(0, p - 50))}
            aria-label="Trekk fra 50 poeng"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-16 text-center text-xl font-bold tabular-nums">
            {points}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setPoints((p) => p + 50)}
            aria-label="Legg til 50 poeng"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {teams.length === 0 ? (
          <p className="text-muted-foreground">Legg til lagene først</p>
        ) : (
          <div className="grid w-full max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3">
            {teams.map((team, index) => {
              const disabled =
                Boolean(round.positiveTeamId) ||
                (penaltyArmed && round.negativeAwardedTo.includes(team.id));
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => handleTeamClick(team.id)}
                  disabled={disabled}
                  className={[
                    "tile flex flex-col items-center gap-1 px-4 py-5 text-center transition-colors",
                    disabled ? "cursor-not-allowed opacity-40" : "",
                    penaltyArmed
                      ? "border-2 border-destructive bg-destructive/10"
                      : "hover:border-accent/70",
                  ].join(" ")}
                >
                  {index < 9 && (
                    <kbd className="rounded bg-muted px-1.5 text-xs text-muted-foreground">
                      {index + 1}
                    </kbd>
                  )}
                  <span className="max-w-full truncate text-lg font-bold">
                    {team.name}
                  </span>
                  <span className="text-2xl font-extrabold tabular-nums text-accent">
                    {team.score}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setPenaltyArmed((armed) => !armed)}
            className={[
              "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
              penaltyArmed
                ? "border-destructive bg-destructive text-destructive-foreground"
                : "border-border text-muted-foreground hover:border-destructive/60 hover:text-destructive",
            ].join(" ")}
          >
            Trekk {penaltyAmount} fra et lag
          </button>

          <button
            type="button"
            onClick={() => useGameStore.getState().endRound()}
            className="text-xs text-muted-foreground/70 underline-offset-4 transition-colors hover:text-muted-foreground hover:underline"
          >
            Ingen klarte den (N)
          </button>
        </div>
      </div>
    </div>
  );
}

function AwardedStep() {
  const round = useGameStore((s) => s.round);
  const teams = useGameStore((s) => s.teams);
  const adjustmentLog = useGameStore((s) => s.adjustmentLog);
  const endRound = useGameStore((s) => s.endRound);
  const undoLastAward = useGameStore((s) => s.undoLastAward);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (useGameStore.getState().roundStep !== "awarded") return;
      if (isTypingTarget(event)) return;

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        endRound();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [endRound]);

  const winner = teams.find((t) => t.id === round.positiveTeamId) ?? null;
  const lastEntry = adjustmentLog[0];
  if (!winner || !lastEntry) return null;
  const before = winner.score - lastEntry.delta;

  return (
    <div className="flex min-h-0 flex-1">
      <QuestionAnswerRecap />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-primary/5 p-6 text-center">
        <p className="text-[clamp(1.6rem,5vh,3.2rem)] font-extrabold text-primary">
          {lastEntry.delta} poeng til {winner.name}
        </p>
        <p className="text-[clamp(1.4rem,4.4vh,2.6rem)] font-bold tabular-nums text-muted-foreground">
          {before} <span aria-hidden>→</span> {winner.score}
        </p>
        <p className="text-lg text-muted-foreground">
          {winner.name} velger neste kort
        </p>

        <div className="mt-4 flex gap-3">
          <Button variant="ghost" onClick={undoLastAward}>
            Angre
          </Button>
          <Button
            size="lg"
            onClick={endRound}
            className="bg-primary px-10 py-6 text-lg text-primary-foreground hover:bg-primary/90"
          >
            Neste spørsmål
          </Button>
        </div>
      </div>
    </div>
  );
}
