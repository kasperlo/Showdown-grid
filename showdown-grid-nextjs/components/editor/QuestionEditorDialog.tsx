"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ImageUpload";
import { useGameStore } from "@/utils/store";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { isQuestionComplete } from "@/utils/quiz-template";

export interface CellRef {
  categoryIndex: number;
  questionIndex: number;
}

interface QuestionEditorDialogProps {
  cell: CellRef | null;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
}

const JOKER_PRESETS = [5, 10, 15, 20];

/**
 * Edits one cell at a time, with next/previous so a board can be filled in one
 * pass. The board itself stays visible behind the dialog, which is how you keep
 * track of where you are in a 25-cell grid.
 */
export function QuestionEditorDialog({
  cell,
  onClose,
  onNavigate,
}: QuestionEditorDialogProps) {
  if (!cell) return null;
  // Keyed per cell so the points field starts from the right value without an
  // effect syncing local state to the store.
  return (
    <EditorBody
      key={`${cell.categoryIndex}-${cell.questionIndex}`}
      cell={cell}
      onClose={onClose}
      onNavigate={onNavigate}
    />
  );
}

function EditorBody({
  cell,
  onClose,
  onNavigate,
}: QuestionEditorDialogProps & { cell: CellRef }) {
  const categories = useGameStore((s) => s.categories);
  const updateQuestion = useGameStore((s) => s.updateQuestion);
  const removeQuestionFromCategory = useGameStore(
    (s) => s.removeQuestionFromCategory
  );

  const category = categories[cell.categoryIndex];
  const question = category?.questions[cell.questionIndex];
  const [pointsText, setPointsText] = useState(() =>
    String(question?.points ?? 0)
  );

  if (!category || !question) return null;

  const patch = (changes: Parameters<typeof updateQuestion>[2]) =>
    updateQuestion(cell.categoryIndex, cell.questionIndex, changes);

  const isFirst = cell.categoryIndex === 0 && cell.questionIndex === 0;
  const isLast =
    cell.categoryIndex === categories.length - 1 &&
    cell.questionIndex === category.questions.length - 1;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{category.name}</span>
            <span className="text-accent">{question.points}</span>
            {question.isJoker && (
              <span className="rounded-full bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 px-2 py-0.5 text-xs font-black text-white">
                JOKER
              </span>
            )}
            {!isQuestionComplete(question) && (
              <span className="rounded-full border border-destructive/60 px-2 py-0.5 text-xs text-destructive">
                Ufullstendig
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Endringer lagres automatisk.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="flex items-end gap-4">
            <div>
              <Label htmlFor="cell-points">Poeng</Label>
              <Input
                id="cell-points"
                type="number"
                min={0}
                step={50}
                value={pointsText}
                onChange={(e) => {
                  setPointsText(e.target.value);
                  const parsed = parseInt(e.target.value, 10);
                  if (Number.isFinite(parsed)) patch({ points: parsed });
                }}
                onBlur={() => {
                  const parsed = parseInt(pointsText, 10);
                  if (!Number.isFinite(parsed) || parsed < 0) {
                    setPointsText("100");
                    patch({ points: 100 });
                  }
                }}
                className="mt-1 w-28"
              />
            </div>

            <div className="flex items-center gap-2 pb-1">
              <Switch
                id="cell-joker"
                checked={Boolean(question.isJoker)}
                onCheckedChange={(checked) =>
                  patch(
                    checked
                      ? { isJoker: true, jokerTimer: question.jokerTimer || 10 }
                      : { isJoker: false, jokerTask: "", jokerTimer: 10 }
                  )
                }
              />
              <Label htmlFor="cell-joker">Joker-oppgave</Label>
            </div>
          </div>

          {question.isJoker ? (
            <div className="space-y-4 rounded-lg border border-yellow-400/30 bg-gradient-to-br from-yellow-500/5 via-red-500/5 to-purple-500/5 p-3">
              <div>
                <Label htmlFor="cell-joker-task">Oppgave</Label>
                <Textarea
                  id="cell-joker-task"
                  value={question.jokerTask ?? ""}
                  onChange={(e) => patch({ jokerTask: e.target.value })}
                  placeholder="Beskriv oppgaven laget må løse…"
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="cell-joker-timer">Sekunder</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    id="cell-joker-timer"
                    type="number"
                    min={3}
                    max={300}
                    value={question.jokerTimer ?? 10}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      patch({
                        jokerTimer: Number.isFinite(parsed) ? parsed : 10,
                      });
                    }}
                    className="w-20"
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
              </div>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="cell-question">Spørsmål</Label>
                <Textarea
                  id="cell-question"
                  value={question.question}
                  onChange={(e) => patch({ question: e.target.value })}
                  placeholder="Hva skal laget svare på?"
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="cell-answer">Svar</Label>
                <Textarea
                  id="cell-answer"
                  value={question.answer}
                  onChange={(e) => patch({ answer: e.target.value })}
                  placeholder="Det riktige svaret"
                  rows={2}
                  className="mt-1"
                />
              </div>

              <ImageUpload
                value={question.imageUrl}
                onChange={(url) => patch({ imageUrl: url })}
                label="Bilde (valgfritt)"
              />
            </>
          )}

          {category.questions.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                removeQuestionFromCategory(
                  cell.categoryIndex,
                  cell.questionIndex
                );
                onClose();
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Slett dette feltet
            </Button>
          )}
        </div>

        <DialogFooter className="flex-row justify-between gap-2 border-t border-border pt-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isFirst}
              onClick={() => onNavigate(-1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Forrige
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isLast}
              onClick={() => onNavigate(1)}
            >
              Neste
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" onClick={onClose}>
            Ferdig
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
