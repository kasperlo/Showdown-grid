"use client";

import { useGameStore } from "@/utils/store";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Play } from "lucide-react";
import { readiness } from "@/utils/card-status";

/**
 * The state of the board in numbers, and the way out of edit mode. Counts
 * rather than an explanation: the dots on the tiles are the same two colours,
 * so this doubles as the key without a sentence telling you so.
 */
export function BoardLegend() {
  const categories = useGameStore((s) => s.categories);
  const setEditMode = useGameStore((s) => s.setEditMode);
  const { complete, missing, withImage } = readiness(categories);

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <div className="tile flex items-center gap-4 px-3.5 py-2.5 text-xs">
        <span className="flex items-center gap-1.5" title="Ferdige kort">
          <span className="h-[7px] w-[7px] rounded-full bg-success" aria-hidden />
          Ferdig <span className="font-bold tabular-nums">{complete}</span>
        </span>
        <span className="flex items-center gap-1.5" title="Kort som mangler noe">
          <span
            className="h-[7px] w-[7px] rounded-full bg-destructive"
            aria-hidden
          />
          Mangler <span className="font-bold tabular-nums">{missing}</span>
        </span>
        <span className="flex items-center gap-1.5" title="Kort med bilde">
          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="font-bold tabular-nums">{withImage}</span>
        </span>
      </div>

      <Button
        onClick={() => setEditMode(false)}
        className="h-10 gap-2 rounded-xl bg-accent px-5 text-base font-extrabold text-accent-foreground hover:bg-accent/90"
      >
        <Play className="h-4 w-4" />
        Start spillet
      </Button>
    </div>
  );
}
