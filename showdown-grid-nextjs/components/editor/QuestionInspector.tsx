"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/utils/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ImageUpload";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Code2,
  ImagePlus,
  ListChecks,
  Trash2,
  X,
} from "lucide-react";
import {
  cardAt,
  cardStatus,
  readiness,
  sameCard,
  statusLabel,
} from "@/utils/card-status";

const JOKER_PRESETS = [5, 10, 15, 20];

/**
 * The side panel: one card at a time, plus the queue that decides what "next"
 * means. Two ways in — clicking a card (silent queue over the whole board) or
 * starting a review (counter, progress, numbered tiles) — and the only
 * difference between them is whether the header is shown.
 */
export function QuestionInspector() {
  const selectedCard = useGameStore((s) => s.selectedCard);
  if (!selectedCard) return null;
  // Keyed per card so per-card panel state (the collapsed image field) resets
  // by remounting instead of by an effect that has to undo the last card.
  return (
    <InspectorBody
      key={`${selectedCard.categoryIndex}-${selectedCard.questionIndex}`}
    />
  );
}

function InspectorBody() {
  const categories = useGameStore((s) => s.categories);
  const selectedCard = useGameStore((s) => s.selectedCard);
  const queue = useGameStore((s) => s.queue);
  const selectCard = useGameStore((s) => s.selectCard);
  const startQueue = useGameStore((s) => s.startQueue);
  const closeQueue = useGameStore((s) => s.closeQueue);
  const queueNext = useGameStore((s) => s.queueNext);
  const queuePrev = useGameStore((s) => s.queuePrev);
  const updateQuestion = useGameStore((s) => s.updateQuestion);
  const removeQuestionFromCategory = useGameStore(
    (s) => s.removeQuestionFromCategory
  );

  const question = cardAt(categories, selectedCard);
  const counts = readiness(categories);
  const [imageOpen, setImageOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  // Keyboard flow. Skipped while typing, so the shortcuts never eat text.
  useEffect(() => {
    if (!selectedCard) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (event.key === "Escape") {
        event.preventDefault();
        selectCard(null);
        return;
      }
      if (typing) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        queueNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        queuePrev();
      } else if (event.key.toLowerCase() === "j" && selectedCard) {
        event.preventDefault();
        const current = cardAt(useGameStore.getState().categories, selectedCard);
        if (!current) return;
        updateQuestion(
          selectedCard.categoryIndex,
          selectedCard.questionIndex,
          current.isJoker
            ? { isJoker: false, jokerTask: "" }
            : { isJoker: true, jokerTimer: current.jokerTimer || 10 }
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedCard, selectCard, queueNext, queuePrev, updateQuestion]);

  if (!selectedCard || !question) return null;

  const category = categories[selectedCard.categoryIndex];
  const status = cardStatus(question);
  const warning = statusLabel(status);
  const patch = (changes: Parameters<typeof updateQuestion>[2]) =>
    updateQuestion(
      selectedCard.categoryIndex,
      selectedCard.questionIndex,
      changes
    );

  const position = queue ? queue.position + 1 : 1;
  const total = queue?.ids.length ?? 1;
  const isLast = queue ? queue.position >= queue.ids.length - 1 : true;
  const isFirst = queue ? queue.position <= 0 : true;
  const remaining = queue?.ids.slice(queue.position, queue.position + 5) ?? [];

  return (
    <aside className="flex h-full min-h-0 flex-col bg-card/80">
      {queue?.active && (
        <div className="space-y-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/50 bg-destructive/[0.16] px-2.5 py-1 font-mono text-xs font-bold text-destructive">
              <ListChecks className="h-3.5 w-3.5" />
              {position} / {total}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7"
              onClick={closeQueue}
              title="Avslutt gjennomgangen"
              aria-label="Avslutt gjennomgangen"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* One segment per card reads well up to about a dozen; past that it
              is a row of stripes, so it becomes a single bar. */}
          {queue.ids.length <= 12 ? (
            <div className="flex gap-1" aria-hidden>
              {queue.ids.map((_, index) => (
                <span
                  key={index}
                  className={`h-[5px] flex-1 rounded-full ${
                    index <= queue.position ? "bg-accent" : "bg-border"
                  }`}
                />
              ))}
            </div>
          ) : (
            <div className="h-[5px] overflow-hidden rounded-full bg-border" aria-hidden>
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${(position / total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2.5">
        <FilterChip
          label="Mangler"
          count={counts.missing}
          active={queue?.active === true && queue.filter === "incomplete"}
          onClick={() => startQueue("incomplete")}
        />
        <FilterChip
          label="Alle"
          count={counts.total}
          active={queue?.active === true && queue.filter === "all"}
          onClick={() => startQueue("all")}
        />
        <FilterChip
          label="Kolonnen"
          count={category?.questions.length ?? 0}
          active={queue?.active === true && queue.filter === "category"}
          onClick={() => startQueue("category", selectedCard.categoryIndex)}
        />
        <FilterChip
          label="Jokere"
          count={counts.jokers}
          active={queue?.active === true && queue.filter === "jokers"}
          onClick={() => startQueue("jokers")}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="category-header !h-auto rounded-full px-3 py-1 text-xs">
            {category?.name}
          </span>
          <span className="text-2xl font-black tabular-nums text-accent">
            {question.points}
          </span>
          {!queue?.active && (
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {position} / {total}
            </span>
          )}
        </div>

        {warning && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/[0.12] px-3 py-2 text-sm text-destructive">
            <CircleAlert className="h-4 w-4 shrink-0" />
            {warning}
          </p>
        )}

        {question.isJoker ? (
          <>
            <Field label="Oppgave">
              <Textarea
                value={question.jokerTask ?? ""}
                onChange={(e) => patch({ jokerTask: e.target.value })}
                rows={4}
                autoFocus
                className="text-base font-semibold leading-snug"
              />
            </Field>

            <Field label="Sekunder">
              <div className="flex flex-wrap items-center gap-1.5">
                <Input
                  type="number"
                  min={3}
                  max={300}
                  value={question.jokerTimer ?? 10}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    patch({ jokerTimer: Number.isFinite(parsed) ? parsed : 10 });
                  }}
                  className="w-20"
                  aria-label="Sekunder"
                />
                {JOKER_PRESETS.map((seconds) => (
                  <Button
                    key={seconds}
                    type="button"
                    size="sm"
                    variant={
                      question.jokerTimer === seconds ? "default" : "outline"
                    }
                    onClick={() => patch({ jokerTimer: seconds })}
                  >
                    {seconds}s
                  </Button>
                ))}
              </div>
            </Field>
          </>
        ) : (
          <>
            <Field label="Spørsmål">
              <Textarea
                value={question.question}
                onChange={(e) => patch({ question: e.target.value })}
                rows={3}
                autoFocus
                className="text-base font-semibold leading-snug"
              />
            </Field>

            <Field label="Svar">
              <Textarea
                value={question.answer}
                onChange={(e) => patch({ answer: e.target.value })}
                rows={2}
                spellCheck={!question.code?.trim()}
                className={`leading-snug ${
                  question.code?.trim()
                    ? "font-mono text-sm"
                    : "text-base font-semibold"
                } ${question.answer.trim() ? "" : "border-accent"}`}
              />
            </Field>

            {question.code?.trim() || codeOpen ? (
              <Field label="Kode">
                <Textarea
                  value={question.code ?? ""}
                  onChange={(e) => patch({ code: e.target.value })}
                  onKeyDown={(e) => {
                    // Tab indents instead of leaving the field. Without this you
                    // cannot type indented code at all, only paste it.
                    if (e.key !== "Tab" || e.shiftKey) return;
                    e.preventDefault();
                    const el = e.currentTarget;
                    const { selectionStart: from, selectionEnd: to, value } = el;
                    patch({
                      code: `${value.slice(0, from)}  ${value.slice(to)}`,
                    });
                    requestAnimationFrame(() => {
                      el.selectionStart = el.selectionEnd = from + 2;
                    });
                  }}
                  rows={6}
                  spellCheck={false}
                  placeholder="console.log(typeof null)"
                  className="font-mono text-sm leading-relaxed"
                />
              </Field>
            ) : null}

            <div className="flex flex-wrap gap-1">
              {!question.code?.trim() && !codeOpen && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={() => setCodeOpen(true)}
                >
                  <Code2 className="h-4 w-4" />
                  Kode
                </Button>
              )}

              {question.imageUrl?.trim() || imageOpen ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={() => setImageOpen(true)}
                >
                  <ImagePlus className="h-4 w-4" />
                  Bilde
                </Button>
              )}
            </div>

            {(question.imageUrl?.trim() || imageOpen) && (
              <ImageUpload
                value={question.imageUrl}
                onChange={(url) => patch({ imageUrl: url })}
                label="Bilde"
              />
            )}
          </>
        )}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <Label htmlFor="inspector-joker" title="Bytter kortet til en oppgave (J)">
            Joker
          </Label>
          <Switch
            id="inspector-joker"
            checked={Boolean(question.isJoker)}
            onCheckedChange={(checked) =>
              patch(
                checked
                  ? { isJoker: true, jokerTimer: question.jokerTimer || 10 }
                  : { isJoker: false, jokerTask: "" }
              )
            }
          />
        </div>

        {remaining.length > 1 && (
          <ul className="space-y-1 border-t border-border pt-4">
            {remaining.map((ref, index) => {
              const card = cardAt(categories, ref);
              if (!card) return null;
              const refStatus = cardStatus(card);
              const isCurrent = sameCard(ref, selectedCard);
              return (
                <li key={`${ref.categoryIndex}-${ref.questionIndex}-${index}`}>
                  <button
                    type="button"
                    onClick={() => selectCard(ref)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                      isCurrent
                        ? "border border-accent/50 bg-accent/[0.14]"
                        : "border border-border hover:bg-border/50"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        refStatus === "complete" ? "bg-success" : "bg-destructive"
                      }`}
                      aria-hidden
                    />
                    <span className="truncate tabular-nums">
                      {categories[ref.categoryIndex]?.name} {card.points}
                    </span>
                    <span className="ml-auto shrink-0 text-muted-foreground">
                      {statusLabel(refStatus) ?? "Ferdig"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {(category?.questions.length ?? 0) > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              removeQuestionFromCategory(
                selectedCard.categoryIndex,
                selectedCard.questionIndex
              );
              selectCard(null);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Slett kortet
          </Button>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-border bg-background/60 px-4 py-3">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={isFirst}
          onClick={queuePrev}
          title="Forrige kort (←)"
          aria-label="Forrige kort"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          className="h-9 flex-1 gap-2 bg-accent font-extrabold text-accent-foreground hover:bg-accent/90"
          disabled={isLast}
          onClick={queueNext}
          title="Neste kort i køen (→)"
        >
          Neste
          <ArrowRight className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={isLast}
          onClick={queueNext}
          title="Neste kort (→)"
          aria-label="Neste kort"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count === 0}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors disabled:opacity-40 ${
        active
          ? "border border-destructive/50 bg-destructive/[0.16] font-bold text-destructive"
          : "border border-border text-muted-foreground hover:bg-border/50"
      }`}
      title={`Gå gjennom: ${label.toLowerCase()}`}
    >
      {label}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}


