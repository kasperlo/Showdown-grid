"use client";

import { useGameStore } from "@/utils/store";
import { Pencil, Play } from "lucide-react";

/**
 * Play or edit. Lives in the header while hosting and in the editor bar while
 * editing, so it never adds a row of its own.
 */
export function EditModeToggle() {
  const editMode = useGameStore((s) => s.editMode);
  const setEditMode = useGameStore((s) => s.setEditMode);
  const canEdit = useGameStore((s) => s.canEditActiveQuiz());

  if (!canEdit) return null;

  return (
    <div
      className="inline-flex rounded-full border border-border bg-card p-[3px]"
      role="group"
      aria-label="Spill eller rediger"
    >
      <button
        type="button"
        onClick={() => setEditMode(false)}
        aria-pressed={!editMode}
        className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-sm transition-colors ${
          editMode
            ? "font-semibold text-muted-foreground"
            : "bg-accent font-bold text-accent-foreground"
        }`}
      >
        <Play className="h-3.5 w-3.5" />
        Spill
      </button>
      <button
        type="button"
        onClick={() => setEditMode(true)}
        aria-pressed={editMode}
        className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-sm transition-colors ${
          editMode
            ? "bg-accent font-bold text-accent-foreground"
            : "font-semibold text-muted-foreground"
        }`}
      >
        <Pencil className="h-3.5 w-3.5" />
        Rediger
      </button>
    </div>
  );
}
