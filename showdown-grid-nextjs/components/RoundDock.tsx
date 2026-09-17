"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useGameStore } from "@/utils/store";
import { AddTeamInline } from "@/components/AddTeamInline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";

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

  const penaltyAbs = lastQuestion ? Math.round(lastQuestion.points * 0.5) : 0;

  const [mode, setMode] = useState<"plus" | "minus">("plus");
  const [showBurst, setShowBurst] = useState(false);
  const [burstEmojis, setBurstEmojis] = useState<string[]>(POS_EMOJIS);
  const [customPointsText, setCustomPointsText] = useState<string>(() =>
    String(lastQuestion?.points ?? 0),
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
        String(next === "plus" ? lastQuestion.points : penaltyAbs),
      );
    },
    [lastQuestion, penaltyAbs],
  );

  const awardingBlocked = isQuestionOpen || !lastQuestion;
  const winner = teams.find((t) => t.id === round.positiveTeamId) ?? null;
  const somethingHappened = Boolean(
    round.positiveTeamId || round.negativeAwardedTo.length,
  );

  const awardTo = useCallback(
    (teamId: string) => {
      if (awardingBlocked) return;

      if (mode === "plus") {
        if (round.positiveTeamId) return;
        setBurstEmojis(POS_EMOJIS);
        setShowBurst(true);
        // Let the canvas mount before the state change that re-renders the dock.
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
    ],
  );

  // Host shortcuts. Ignored while typing so the points and team-name fields
  // still work.
  //
  // Deliberately not Escape or Enter: both are in flight from the question
  // modal at the moment this listener mounts. Closing the modal with Escape let
  // the same keypress reach here and end the round, which marked the card
  // played and skipped the points entirely.
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
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
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

      {/* Nothing is shown while the question is on screen. The dock used to stay
          up with "Lukk spørsmålet for å tildele poeng", which read as a second
          surface competing with the question the room is looking at.

          It sits in the page flow rather than fixed to the bottom, in the same
          slot as the standings: fixed, it covered the top row of the standings
          it was meant to sit beside. */}
      {lastQuestion && !isQuestionOpen && (
        <div className="tile space-y-2 p-2.5 sm:p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs">
                <span className="max-w-[9rem] truncate">
                  {lastQuestion.categoryName}
                </span>
                <span className="font-bold text-accent">
                  {lastQuestion.points}
                </span>
              </span>

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
                  title="Feil svar — trekker poeng (F)"
                  aria-pressed={mode === "minus"}
                >
                  <Minus className="h-4 w-4" />
                  <span className="hidden sm:inline">Feil</span>
                </button>
              </div>

              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={50}
                value={customPointsText}
                onChange={(e) => setCustomPointsText(e.target.value)}
                className="h-8 w-20 text-sm"
                aria-label="Poeng å tildele"
                title="Poeng å tildele — endre for å gi halv pott o.l."
              />
            </div>

            <Button
              onClick={() => endRound()}
              variant={round.positiveTeamId ? "default" : "outline"}
              className={
                round.positiveTeamId
                  ? "gap-2 bg-primary text-primary-foreground"
                  : "gap-2"
              }
              title="Gå videre til brettet (N)"
            >
              {somethingHappened ? "Neste spørsmål" : "Ingen klarte den"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* One line that says what to do next, and nothing else. */}
          <p className="text-center text-[clamp(0.85rem,2.1vh,1.25rem)] font-semibold">
            {winner ? (
              <span className="inline-flex items-center gap-2 text-success">
                <Check className="h-4 w-4" />
                {customPoints} poeng til {winner.name}
              </span>
            ) : teams.length === 0 ? (
              <span className="text-muted-foreground">
                Legg til lagene først
              </span>
            ) : mode === "plus" ? (
              "Hvem svarte riktig?"
            ) : (
              "Hvem svarte feil?"
            )}
          </p>

          {teams.length === 0 ? (
            <div className="mx-auto max-w-sm">
              <AddTeamInline autoFocus />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {teams.map((team, index) => {
                const isWinner = round.positiveTeamId === team.id;
                const hasNeg = round.negativeAwardedTo.includes(team.id);
                const chipActive =
                  (mode === "plus" && isWinner) || (mode === "minus" && hasNeg);
                const chipDisabled =
                  (mode === "plus" && !!round.positiveTeamId) ||
                  (mode === "minus" && (hasNeg || !!round.positiveTeamId));

                return (
                  <button
                    key={team.id}
                    onClick={() => awardTo(team.id)}
                    disabled={chipDisabled}
                    className={[
                      "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[clamp(0.85rem,2.1vh,1.3rem)] transition-colors",
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
                    <span className="text-[clamp(0.95rem,2.6vh,1.6rem)] font-bold tabular-nums">
                      {team.score}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
