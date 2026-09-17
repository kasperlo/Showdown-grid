"use client";

import { useGameStore } from "@/utils/store";
import { AlertTriangle, Check, Cloud, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Says out loud whether the work is stored. The app used to save silently and
 * fail silently, so the only way to find out was to reload and see what was
 * left.
 *
 * The "Lagret" flash fades via the store (see reportSaved), which keeps this a
 * pure render with no timers of its own.
 */
export function SaveIndicator({
  className,
  showIdle = false,
}: {
  className?: string;
  /**
   * Show "Autolagrer" when nothing has been saved yet. On by default in the
   * editor, off while hosting: there, the thing being stored is the running
   * session, not the quiz, and saying "autolagrer" would point at the wrong one.
   */
  showIdle?: boolean;
}) {
  const saveStatus = useGameStore((s) => s.saveStatus);
  const saveError = useGameStore((s) => s.saveError);
  const lastSavedAt = useGameStore((s) => s.lastSavedAt);

  const base = "inline-flex items-center gap-1.5 text-xs";

  if (saveStatus === "readonly") {
    return (
      <span className={cn(base, "text-muted-foreground", className)}>
        <Lock className="h-3.5 w-3.5" aria-hidden />
        Kun spilling — endringer lagres ikke
      </span>
    );
  }

  if (saveStatus === "saving") {
    return (
      <span className={cn(base, className)} aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Lagrer…
      </span>
    );
  }

  if (saveStatus === "error") {
    return (
      <span
        className={cn(base, "text-destructive", className)}
        role="alert"
        title={saveError ?? undefined}
      >
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        Ikke lagret{saveError ? `: ${saveError}` : ""}
      </span>
    );
  }

  if (saveStatus === "saved") {
    return (
      <span className={cn(base, "text-success", className)} aria-live="polite">
        <Check className="h-3.5 w-3.5" aria-hidden />
        Lagret
      </span>
    );
  }

  if (!lastSavedAt && !showIdle) return null;

  return (
    <span className={cn(base, "text-muted-foreground", className)}>
      <Cloud className="h-3.5 w-3.5" aria-hidden />
      {lastSavedAt ? `Lagret ${formatClock(lastSavedAt)}` : "Autolagrer"}
    </span>
  );
}

function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
