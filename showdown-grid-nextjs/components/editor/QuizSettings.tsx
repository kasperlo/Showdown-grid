"use client";

import { useGameStore } from "@/utils/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ThemeSelector } from "@/components/ThemeSelector";
import type { TurnRule } from "@/utils/types";
import { BoardTransfer } from "./BoardTransfer";
import { clampedInteger, DraftInput } from "./DraftInput";
import { useQuizTitleField } from "./EditableQuizTitle";
import { ShareAccess } from "./ShareAccess";

const TIMER_PRESETS = [30, 60, 90, 120];
const JOKER_PRESETS = [5, 10, 15, 20];
const DEFAULT_TIMER_SECONDS = 60;

const TURN_RULES: { value: TurnRule; label: string; description: string }[] = [
  {
    value: "winner",
    label: "Laget som svarte riktig",
    description: "Velger neste kort selv. Svarer ingen riktig, går turen videre.",
  },
  {
    value: "rotation",
    label: "Lagene etter tur",
    description: "Fast rekkefølge, uansett hvem som svarer.",
  },
];

/**
 * What each quiz's timer was before it was switched off, so switching it back
 * on restores that rather than a default, also after the settings were closed.
 */
const secondsBeforeOff = new Map<string, number>();

export function QuizSettings() {
  const titleField = useQuizTitleField();
  const quizDescription = useGameStore((s) => s.quizDescription);
  const setQuizDescription = useGameStore((s) => s.setQuizDescription);
  const quizTimeLimit = useGameStore((s) => s.quizTimeLimit);
  const setQuizTimeLimit = useGameStore((s) => s.setQuizTimeLimit);
  const jokerTimeLimit = useGameStore((s) => s.jokerTimeLimit);
  const setJokerTimeLimit = useGameStore((s) => s.setJokerTimeLimit);
  const quizIsPublic = useGameStore((s) => s.quizIsPublic);
  const setQuizIsPublic = useGameStore((s) => s.setQuizIsPublic);
  const turnRule = useGameStore((s) => s.turnRule);
  const setTurnRule = useGameStore((s) => s.setTurnRule);
  const isOwner = useGameStore((s) => s.isOwnerOfActiveQuiz());
  const activeQuizId = useGameStore((s) => s.activeQuizId) ?? "";

  const toggleTimer = (on: boolean) => {
    if (!on && quizTimeLimit !== null) {
      secondsBeforeOff.set(activeQuizId, quizTimeLimit);
    }
    setQuizTimeLimit(
      on ? secondsBeforeOff.get(activeQuizId) ?? DEFAULT_TIMER_SECONDS : null
    );
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <Label htmlFor="quiz-title" className="text-base font-semibold">
            Tittel
          </Label>
          <Input
            id="quiz-title"
            {...titleField}
            placeholder="Navnet på quizen"
            className="mt-1"
          />
          {!titleField.value.trim() && (
            <p className="mt-1 text-xs text-destructive">Tittelen mangler</p>
          )}
        </div>

        <div>
          <Label htmlFor="quiz-description" className="text-base font-semibold">
            Beskrivelse
          </Label>
          <Textarea
            id="quiz-description"
            value={quizDescription}
            onChange={(e) => setQuizDescription(e.target.value)}
            placeholder="En kort beskrivelse"
            rows={2}
            className="mt-1"
          />
        </div>
      </div>

      <div className="space-y-4 border-t border-border pt-6">
        <div className="flex items-center justify-between gap-4">
          <Label
            className="text-base font-semibold"
            title="Nedtelling som vises i spørsmålsvinduet"
          >
            Tid per spørsmål
          </Label>
          <Switch
            checked={quizTimeLimit !== null}
            onCheckedChange={toggleTimer}
            aria-label="Slå tidsbegrensning av eller på"
          />
        </div>

        {quizTimeLimit !== null && (
          <div className="flex flex-wrap items-center gap-2">
            <DraftInput
              type="number"
              min={5}
              max={600}
              value={String(quizTimeLimit)}
              onCommit={(raw) => {
                // The server keeps the timer at 5 seconds or more.
                const seconds = clampedInteger(raw, 5, 600);
                if (seconds !== null) setQuizTimeLimit(seconds);
              }}
              className="w-24"
              aria-label="Sekunder per spørsmål"
            />
            {TIMER_PRESETS.map((seconds) => (
              <Button
                key={seconds}
                type="button"
                size="sm"
                variant={quizTimeLimit === seconds ? "default" : "outline"}
                onClick={() => setQuizTimeLimit(seconds)}
              >
                {seconds}s
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <Label
          className="text-base font-semibold"
          title="Brukes av joker-oppgaver uten egen tid"
        >
          Standard joker-tid
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={3}
            max={300}
            value={jokerTimeLimit ?? 10}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              setJokerTimeLimit(Number.isFinite(parsed) ? parsed : 10);
            }}
            className="w-24"
            aria-label="Standard joker-tid i sekunder"
          />
          {JOKER_PRESETS.map((seconds) => (
            <Button
              key={seconds}
              type="button"
              size="sm"
              variant={jokerTimeLimit === seconds ? "default" : "outline"}
              onClick={() => setJokerTimeLimit(seconds)}
            >
              {seconds}s
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <Label id="turn-rule-label" className="text-base font-semibold">
          Hvem velger neste kort?
        </Label>
        <RadioGroup
          value={turnRule}
          onValueChange={(value) =>
            setTurnRule(value === "rotation" ? "rotation" : "winner")
          }
          aria-labelledby="turn-rule-label"
        >
          {TURN_RULES.map((rule) => (
            <div key={rule.value} className="flex items-start gap-3">
              <RadioGroupItem
                value={rule.value}
                id={`turn-rule-${rule.value}`}
                className="mt-0.5"
              />
              <Label
                htmlFor={`turn-rule-${rule.value}`}
                className="space-y-1 font-normal leading-snug"
              >
                <span className="block font-semibold">{rule.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {rule.description}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="border-t border-border pt-6">
        <ThemeSelector />
      </div>

      <div className="border-t border-border pt-6">
        <div className="flex items-center justify-between gap-4">
          <Label
            className="text-base font-semibold"
            title="Alle kan finne og spille quizen, men ikke endre den"
          >
            Offentlig quiz
          </Label>
          <Switch
            checked={quizIsPublic}
            onCheckedChange={setQuizIsPublic}
            disabled={!isOwner}
            aria-label="Gjør quizen offentlig"
          />
        </div>
        {!isOwner && (
          <p className="mt-1 text-xs text-muted-foreground">
            Bare eieren kan endre dette.
          </p>
        )}
      </div>

      {isOwner && (
        <div className="border-t border-border pt-6">
          <ShareAccess />
        </div>
      )}

      <div className="border-t border-border pt-6">
        <BoardTransfer />
      </div>
    </div>
  );
}
