"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useGameStore } from "@/utils/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, SkipForward, X } from "lucide-react";

const EmojiBurst = dynamic(() => import("./EmojiBurst"), { ssr: false });

const POS_EMOJIS = ["🔥", "💥", "💣", "🤟", "😎", "🍻", "🍾"];
const NEG_EMOJIS = ["🤣", "😂", "💀", "⚰️", "🤡"];

/**
 * Where points are handed out, after the question modal is closed.
 *
 * Teams are numbered so the host can award with the number keys instead of
 * aiming at a chip on a laptop trackpad while a room waits.
 */
export function RoundDock() {
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  // Keyed per question so the mode and the points field reset by remounting.
  // Syncing them with effects meant the penalty mode could carry over into the
  // next round and put points on the wrong side.
  const key = lastQuestion
    ? `${lastQuestion.categoryName}-${lastQuestion.questionIndex}`
    : "idle";
  return <DockBody key={key} />;
}

function DockBody() {
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  const isQuestionOpen = useGameStore((s) => s.isQuestionOpen);
  const teams = useGameStore((s) => s.teams);
  const round = useGameStore((s) => s.round);
  const awardPositive = useGameStore((s) => s.awardPositive);
  const awardNegative = useGameStore((s) => s.awardNegative);
  const endRound = useGameStore((s) => s.endRound);
  const skipQuestion = useGameStore((s) => s.skipQuestion);

  const penaltyAbs = lastQuestion ? Math.round(lastQuestion.points * 0.5) : 0;

  const [mode, setMode] = useState<"plus" | "minus">("plus");
  const [showBurst, setShowBurst] = useState(false);
  const [burstEmojis, setBurstEmojis] = useState<string[]>(POS_EMOJIS);
  const [customPointsText, setCustomPointsText] = useState<string>(() =>
    String(lastQuestion?.points ?? 0)
  );

  const customPoints = useMemo(() => {
    const n = Number.parseInt(customPointsText, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [customPointsText]);

  /** Switching mode also switches the suggested amount to that mode's default. */
  const switchMode = useCallback(
    (next: "plus" | "minus") => {
      setMode(next);
      if (!lastQuestion) return;
      setCustomPointsText(
        String(next === "plus" ? lastQuestion.points : penaltyAbs)
      );
    },
    [lastQuestion, penaltyAbs]
  );

  const awardingBlocked = isQuestionOpen || !lastQuestion;

  const awardTo = useCallback(
    (teamId: string) => {
      if (awardingBlocked) return;

      if (mode === "plus") {
        if (round.positiveTeamId) return;
        setBurstEmojis(POS_EMOJIS);
        setShowBurst(true);
        // Let the canvas mount before the state change that unmounts the dock.
        setTimeout(() => awardPositive(teamId, customPoints), 0);
        return;
      }

      if (round.positiveTeamId) return;
      if (round.negativeAwardedTo.includes(teamId)) return;
      setBurstEmojis(NEG_EMOJIS);
      setShowBurst(true);
      awardNegative(teamId, -customPoints);
    },
    [
      awardingBlocked,
      mode,
      round.positiveTeamId,
      round.negativeAwardedTo,
      customPoints,
      awardPositive,
      awardNegative,
    ]
  );

  // Host shortcuts. Ignored while typing so the points field still works.
  useEffect(() => {
    if (awardingBlocked) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key >= "1" && event.key <= "9") {
        const index = Number(event.key) - 1;
        const team = teams[index];
        if (team) {
          event.preventDefault();
          awardTo(team.id);
        }
        return;
      }

      if (event.key === "+" || event.key.toLowerCase() === "r") {
        switchMode("plus");
      } else if (event.key === "-" || event.key.toLowerCase() === "f") {
        switchMode("minus");
      } else if (event.key === "Escape") {
        endRound();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [awardingBlocked, teams, awardTo, endRound, switchMode]);

  if (!lastQuestion && !showBurst) return null;

  return (
    <>
      <EmojiBurst
        show={showBurst}
        emojis={burstEmojis}
        duration={1500}
        intensity={1.1}
        onComplete={() => setShowBurst(false)}
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 pb-3 sm:bottom-4 sm:pb-0">
        <div className="container mx-auto max-w-5xl px-2 sm:px-4">
          <div className="pointer-events-auto tile space-y-2 p-2 sm:p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {lastQuestion && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs">
                    <span className="max-w-[9rem] truncate">
                      {lastQuestion.categoryName}
                    </span>
                    <span className="font-bold text-accent">
                      {lastQuestion.points}
                    </span>
                  </span>
                )}

                <div className="inline-flex overflow-hidden rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => switchMode("plus")}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm ${
                      mode === "plus"
                        ? "bg-success text-success-foreground"
                        : "bg-transparent"
                    }`}
                    title="Riktig svar (R)"
                    aria-pressed={mode === "plus"}
                    disabled={!lastQuestion}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Riktig</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("minus")}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm ${
                      mode === "minus"
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-transparent"
                    }`}
                    title="Feil svar (F)"
                    aria-pressed={mode === "minus"}
                    disabled={!lastQuestion}
                  >
                    <Minus className="h-4 w-4" />
                    <span className="hidden sm:inline">Feil</span>
                  </button>
                </div>

                {lastQuestion && (
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="hidden md:inline">Poeng</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={50}
                      value={customPointsText}
                      onChange={(e) => setCustomPointsText(e.target.value)}
                      className="h-8 w-20 text-sm"
                      disabled={awardingBlocked}
                      aria-label="Poeng å tildele"
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  onClick={() => skipQuestion()}
                  variant="ghost"
                  size="sm"
                  title="Ingen fikk den — hopp over"
                  disabled={!lastQuestion}
                >
                  <SkipForward className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline">Ingen</span>
                </Button>
                <Button
                  onClick={() => endRound()}
                  variant="ghost"
                  size="icon"
                  title="Avslutt runden (Esc)"
                  aria-label="Avslutt runden"
                  disabled={!lastQuestion}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {isQuestionOpen && lastQuestion ? (
              <p className="text-center text-xs text-muted-foreground">
                Lukk spørsmålet for å tildele poeng
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {teams.map((team, index) => {
                  const isWinner = round.positiveTeamId === team.id;
                  const hasNeg = round.negativeAwardedTo.includes(team.id);
                  const chipActive =
                    (mode === "plus" && isWinner) ||
                    (mode === "minus" && hasNeg);
                  const chipDisabled =
                    awardingBlocked ||
                    (mode === "plus" && !!round.positiveTeamId) ||
                    (mode === "minus" && (hasNeg || !!round.positiveTeamId));

                  return (
                    <button
                      key={team.id}
                      onClick={() => awardTo(team.id)}
                      disabled={chipDisabled}
                      className={[
                        "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm transition-colors",
                        chipDisabled
                          ? "cursor-not-allowed opacity-50"
                          : "hover:bg-muted",
                        chipActive
                          ? mode === "plus"
                            ? "bg-success text-success-foreground"
                            : "bg-destructive text-destructive-foreground"
                          : "bg-popover",
                      ].join(" ")}
                      aria-pressed={chipActive}
                      title={
                        mode === "plus"
                          ? `Tildel +${customPoints} til ${team.name} (${index + 1})`
                          : `Tildel −${customPoints} til ${team.name} (${index + 1})`
                      }
                    >
                      {index < 9 && (
                        <kbd className="rounded bg-muted px-1 text-[0.65rem] text-muted-foreground">
                          {index + 1}
                        </kbd>
                      )}
                      <span className="max-w-[8rem] truncate">{team.name}</span>
                      <span className="font-bold tabular-nums">{team.score}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
