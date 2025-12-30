import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useGameStore } from "@/utils/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus, X } from "lucide-react";

// Lazy load EmojiBurst to reduce initial bundle size
const EmojiBurst = dynamic(() => import("./EmojiBurst"), { ssr: false });

/**
 * Minimal tildelingsdokk med emoji-regn.
 * Én tilfeldig emoji per burst; regner fra toppen; egne sett for +/−.
 */
export function RoundDock() {
  const {
    lastQuestion,
    isQuestionOpen,
    teams,
    round,
    awardPositive,
    awardNegative,
    endRound,
    markQuestionAsAnswered,
  } = useGameStore();

  const POS_EMOJIS = ["🔥", "💥", "💣", "🤟", "😎", "🍻", "🍾"];
  const NEG_EMOJIS = ["🤣", "😂", "💀", "⚰️", "🤡"];

  const [mode, setMode] = useState<"plus" | "minus">("plus");
  const [showBurst, setShowBurst] = useState(false);
  const [burstEmojis, setBurstEmojis] = useState<string[]>(POS_EMOJIS);
  const [customPointsText, setCustomPointsText] = useState<string>("0");

  const penaltyAbs = useMemo(
    () => (lastQuestion ? Math.round(lastQuestion.points * 0.5) : 0),
    [lastQuestion]
  );

  const customPoints = useMemo(() => {
    const n = Number.parseInt(customPointsText, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [customPointsText]);

  // Update custom points when mode or lastQuestion changes
  useEffect(() => {
    if (!lastQuestion) {
      setCustomPointsText("0");
      return;
    }

    if (mode === "plus") {
      setCustomPointsText(String(lastQuestion.points));
    } else {
      setCustomPointsText(String(penaltyAbs));
    }
  }, [mode, lastQuestion, penaltyAbs]);

  // Behold dokken hvis burst spiller, selv om runden er ferdig
  const disabled = isQuestionOpen || !lastQuestion;
  if (!lastQuestion && !showBurst) return null;

  const onTeamClick = (teamId: string) => {
    if (disabled) return;

    if (mode === "plus") {
      if (round.positiveTeamId) return;
      setBurstEmojis(POS_EMOJIS);
      setShowBurst(true);
      // La canvas mounte før endRound via awardPositive
      setTimeout(() => {
        awardPositive(teamId, customPoints);
      }, 0);
    } else if (mode === "minus") {
      if (round.positiveTeamId) return;
      if (round.negativeAwardedTo.includes(teamId)) return;
      setBurstEmojis(NEG_EMOJIS);
      setShowBurst(true);
      awardNegative(teamId, -customPoints); // negative value for penalty
    }
  };

  return (
    <>
      <EmojiBurst
        show={showBurst}
        emojis={burstEmojis}
        duration={1500} // kort og crisp “regn”
        intensity={1.1} // færre elementer
        onComplete={() => setShowBurst(false)}
      />

      <div className="fixed inset-x-0 bottom-6 z-50 pointer-events-none">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="pointer-events-auto tile flex items-center justify-between gap-3 px-3 py-2">
            {/* Venstre: kontekst + modus */}
            <div className="flex items-center gap-3 overflow-hidden">
              {lastQuestion ? (
                <div className="hidden md:flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-border px-2 py-1 text-xs">
                    {lastQuestion.categoryName}
                  </span>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-border px-2 py-1 text-xs">
                    🎉
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMode("plus")}
                    className={`px-3 py-1.5 text-sm inline-flex items-center gap-1 ${
                      mode === "plus"
                        ? "bg-success text-success-foreground"
                        : "bg-transparent"
                    }`}
                    title="Riktig svar"
                    aria-pressed={mode === "plus"}
                    disabled={!lastQuestion}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Riktig</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("minus")}
                    className={`px-3 py-1.5 text-sm inline-flex items-center gap-1 ${
                      mode === "minus"
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-transparent"
                    }`}
                    title="Feil svar"
                    aria-pressed={mode === "minus"}
                    disabled={!lastQuestion}
                  >
                    <Minus className="h-4 w-4" />
                    <span className="hidden sm:inline">Feil</span>
                  </button>
                </div>

                {lastQuestion && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground hidden md:inline">
                      Poeng:
                    </span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={50}
                      value={customPointsText}
                      onChange={(e) => setCustomPointsText(e.target.value)}
                      className="w-20 h-8 text-sm"
                      disabled={!lastQuestion || isQuestionOpen}
                    />
                  </div>
                )}

                {isQuestionOpen && lastQuestion && (
                  <span className="text-xs text-muted-foreground">
                    Lukk modal for å tildele
                  </span>
                )}
              </div>
            </div>

            {/* Midt: lag-chips */}
            <div className="flex items-center gap-2 flex-1 justify-center flex-wrap">
              {teams.map((team) => {
                const isWinner = round.positiveTeamId === team.id;
                const hasNeg = round.negativeAwardedTo.includes(team.id);
                const chipActive =
                  (mode === "plus" && isWinner) || (mode === "minus" && hasNeg);

                const chipDisabled =
                  isQuestionOpen ||
                  !lastQuestion ||
                  (mode === "plus" && !!round.positiveTeamId) ||
                  (mode === "minus" && (hasNeg || !!round.positiveTeamId));

                return (
                  <button
                    key={team.id}
                    onClick={() => onTeamClick(team.id)}
                    disabled={chipDisabled}
                    className={[
                      "px-3 py-1.5 rounded-full border border-border text-sm",
                      "transition-colors",
                      chipDisabled
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-muted",
                      chipActive
                        ? mode === "plus"
                          ? "bg-success text-success-foreground"
                          : "bg-destructive text-destructive-foreground"
                        : "bg-popover",
                    ].join(" ")}
                    aria-pressed={chipActive}
                    title={
                      lastQuestion
                        ? mode === "plus"
                          ? `Tildel +${customPoints} til ${team.name}`
                          : `Tildel −${customPoints} til ${team.name}`
                        : undefined
                    }
                  >
                    {team.name}
                  </button>
                );
              })}
            </div>

            {/* Høyre: skip/avslutt */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  if (lastQuestion) {
                    markQuestionAsAnswered(
                      lastQuestion.categoryName,
                      lastQuestion.questionIndex
                    );
                  }
                  endRound();
                }}
                variant="ghost"
                size="icon"
                title="Avslutt runden"
                aria-label="Avslutt runden"
                disabled={!lastQuestion}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
