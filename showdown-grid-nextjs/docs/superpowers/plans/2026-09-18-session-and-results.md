# Session In Progress + Finale (Del 3 + Del 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `useQuizBootstrap` from silently overwriting an in-progress
session's scores, and make `/results` handle a failed load, an unsaved
session, and a saved one with real UI instead of falling through to an
empty podium.

**Architecture:** `restoreActiveSession` (unchanged) is preceded by a new,
read-only `peekActiveSession`, so the hook can look at a session before
deciding whether to apply it. `useQuizBootstrap` gains a `"resumable"`
status carrying a summary plus two bound actions (`resume`/`startFresh`);
`app/page.tsx` renders a choice screen for it, `app/results/page.tsx`
resolves it silently (a results page always wants the live numbers). The
finale's "already saved" state is a client-side snapshot taken right before
`completeSession()` wipes the store's live scores back to zero — without
it, the saved receipt (points, duration, standings) would vanish the
instant it was written.

**Tech Stack:** Next.js (App Router), React, Zustand, vitest (node
environment).

**Spec:** [docs/superpowers/specs/2026-09-18-redesign-spillmodus.md](../specs/2026-09-18-redesign-spillmodus.md)
— "Del 3 — Økt som pågår" and "Del 4 — Finalen".

**Independent of:** Del 1, Del 2, Del 5 (per the spec's Rekkefølge — this
part has no hard dependency on any of them). The store.ts diff in Task 2
targets the state as Del 2 leaves it (`roundStep`, not `isQuestionOpen`),
matching the spec's suggested order (1 → 2 → 3+4 → 5); see that task's note
for the one-line adjustment needed if this part is done before Del 2.

## Global Constraints

- A `"resumable"` status is only reachable when the session actually has
  progress: "minst ett avkrysset kort eller minst én poengsum ulik null."
  An empty session (a run row exists but nothing happened in it) resumes
  silently, exactly like today.
- `/results` never shows the choice screen — a results page's only job is
  the live numbers, so it resolves `"resumable"` by resuming immediately.
- Duration/answered/team numbers on results, once a session is saved, come
  from the server's response to `POST /api/quiz-runs/:id/complete` (which
  already computes `duration_seconds`, `team_results`,
  `answered_questions`), not from a client-side clock or the store's
  now-reset `teams`/`categories`.

## Assumptions (call out, not silent)

1. **`app/api/quiz-runs/active/route.ts` is not modified**, despite being
   in the spec's Del 3 file list ("må kunne returnere sammendraget"). Its
   existing response already includes everything `peekActiveSession` needs
   (`final_state`, which holds `answeredKeys`/`scores`) — the client
   already has the quiz's `categories`/`teams` loaded (via `loadQuiz`,
   which runs before the peek), so total-question and team-name lookups
   are just local computation, not a new server round trip. Modifying the
   route would duplicate logic the client already has for no behavior
   change. Flagged here rather than silently dropped.
2. **"Spill denne quizen igjen" is a plain `router.push("/")`.** The board
   page's own bootstrap will find no active run (the one just shown was
   just completed) and load a fresh board — no new query param or
   API call needed.
3. **Completing a session no longer auto-navigates to `/history`.** Today's
   `handleComplete` redirects immediately on success. Del 4 wants the
   "saved" state to render *on this page* (the status chip, the "Spill
   igjen"/"Se i historikken"/"Til biblioteket" row) — redirecting away
   would make that UI unreachable. `/history` is now one of the buttons,
   not automatic.
4. **The "saved" state does not survive a page refresh.** It is
   `useState`, not persisted. After `completeSession` succeeds, the run is
   no longer "active" (`ended_at` is set), so a reload's `peekActiveSession`
   finds nothing to resume and the store starts blank — the same gap that
   exists today. Making the receipt reload-proof (e.g. fetching the most
   recent completed run) is a larger change than the spec asks for and is
   left as a follow-up, not silently expanded into this plan.
5. **The standings list below the podium loses per-player names once a
   session is saved** (`TeamResult`, the server's shape, has no `players`
   field — only `teamId`/`teamName`/`finalScore`/`rank`). Acceptable: it's
   cosmetic, and the podium and every score are still exact.
6. **Podium digit contrast (Del 4, point 5)** is implemented with
   `text-foreground` on rank 1 (gold/`bg-accent`) and rank 2
   (silver/`bg-muted`), and `text-background` on rank 3
   (bronze/`bg-secondary`) — the semantic opposite of each background's own
   token pair. Exact hex values differ across the app's three themes
   (classic/modern/christmas), so Task 7 checks contrast in the browser
   against all three rather than trusting the token names alone.

---

### Task 1: `utils/session-progress.ts` — the resumable/silent decision

**Files:**
- Create: `utils/session-progress.ts`
- Test: `utils/__tests__/session-progress.test.ts`

**Interfaces:**
- Produces: `hasSessionProgress(live: LiveGameState | null): boolean`.
- Consumes: `LiveGameState` from `./types`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { hasSessionProgress } from "../session-progress";
import type { LiveGameState } from "../types";

function live(overrides: Partial<LiveGameState>): LiveGameState {
  return {
    answeredKeys: [],
    scores: {},
    adjustmentLog: [],
    currentTurnTeamId: null,
    version: 2,
    ...overrides,
  };
}

describe("hasSessionProgress", () => {
  it("is false for no session at all", () => {
    expect(hasSessionProgress(null)).toBe(false);
  });

  it("is false for a freshly-started session with nothing played", () => {
    expect(hasSessionProgress(live({ scores: { a: 0, b: 0 } }))).toBe(false);
  });

  it("is true once a card has been answered, even with every score at 0", () => {
    expect(
      hasSessionProgress(live({ answeredKeys: ["Mat|0"], scores: { a: 0 } }))
    ).toBe(true);
  });

  it("is true once any team's score differs from 0, even with nothing marked answered", () => {
    // A manual adjustment can move a score without marking a card played.
    expect(hasSessionProgress(live({ scores: { a: 50, b: 0 } }))).toBe(true);
  });

  it("is true for a negative score", () => {
    expect(hasSessionProgress(live({ scores: { a: -50 } }))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- session-progress`
Expected: FAIL — `Cannot find module '../session-progress'`.

- [ ] **Step 3: Implement**

```ts
import type { LiveGameState } from "./types";

/**
 * A session only counts as "in progress" once something in it happened — at
 * least one card marked answered, or at least one score away from 0 (a
 * manual adjustment can move a score without marking a card played). An
 * empty run — created the moment a quiz opens, before anyone has clicked
 * anything — resumes silently instead of prompting a host who never left
 * anything behind.
 */
export function hasSessionProgress(live: LiveGameState | null): boolean {
  if (!live) return false;
  if (live.answeredKeys.length > 0) return true;
  return Object.values(live.scores).some((score) => score !== 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- session-progress`
Expected: PASS, all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add utils/session-progress.ts utils/__tests__/session-progress.test.ts
git commit -m "feat: add hasSessionProgress, the resumable/silent decision"
```

---

### Task 2: `utils/types.ts` + `utils/store.ts` — `peekActiveSession`, `completeSession` returns the saved run

**Files:**
- Modify: `utils/types.ts`
- Modify: `utils/store.ts`

**Interfaces:**
- Produces: `ActiveSessionSummary` (exported type), `GameState.peekActiveSession:
  (quizId: string) => Promise<ActiveSessionSummary | null>`.
  `GameState.completeSession`'s return type changes from `Promise<void>` to
  `Promise<QuizRun | null>`.
- Consumes: `hasSessionProgress` (Task 1), `liveStateFromRunState` (already
  imported in `store.ts`).

- [ ] **Step 1: `utils/types.ts` — add `ActiveSessionSummary`, update the two signatures**

Find:

```ts
export interface QuizRunSummary {
```

Insert immediately before it:

```ts
/** What peekActiveSession reports, before anything is applied to the store. */
export interface ActiveSessionSummary {
  runId: string;
  startedAt: string;
  answered: number;
  total: number;
  teams: { name: string; score: number }[];
  hasProgress: boolean;
}

export interface QuizRunSummary {
```

Find:

```ts
  restoreActiveSession: (quizId: string) => Promise<void>;
  completeSession: (runId: string, quizId?: string) => Promise<void>;
```

Replace with:

```ts
  restoreActiveSession: (quizId: string) => Promise<void>;
  /** Looks at the active session without applying it — see completeSession
   * for the terminal state and restoreActiveSession for actually applying it. */
  peekActiveSession: (quizId: string) => Promise<ActiveSessionSummary | null>;
  completeSession: (runId: string, quizId?: string) => Promise<QuizRun | null>;
```

- [ ] **Step 2: `utils/store.ts` — import the new pieces**

Find:

```ts
import type {
  GameState,
  Category,
  Question,
  LastQuestion,
  AdjustmentEntry,
  QuizTheme,
  LoadQuizInput,
} from "./types";
```

Replace with:

```ts
import type {
  GameState,
  Category,
  Question,
  LastQuestion,
  AdjustmentEntry,
  QuizTheme,
  LoadQuizInput,
  QuizRun,
} from "./types";
import { hasSessionProgress } from "./session-progress";
```

(If Task 2 of the round-flow plan already added `RoundStep` to this same
import list, add `QuizRun` alongside it rather than replacing the whole
block — the two are independent additions to the same statement.)

- [ ] **Step 3: Add `peekActiveSession`, right after `restoreActiveSession`**

Find:

```ts
      function applyLive(live: NonNullable<ReturnType<typeof liveStateFromRunState>>) {
        const state = get();
        const merged = mergeLiveIntoTemplate(extractTemplate(state), live);
        set({
          categories: merged.categories,
          teams: merged.teams,
          adjustmentLog: merged.adjustmentLog,
          currentTurnTeamId: merged.currentTurnTeamId,
          hasUnsavedChanges: false,
        });
      }
    },

    completeSession: async (runId: string, quizId?: string) => {
```

Replace with:

```ts
      function applyLive(live: NonNullable<ReturnType<typeof liveStateFromRunState>>) {
        const state = get();
        const merged = mergeLiveIntoTemplate(extractTemplate(state), live);
        set({
          categories: merged.categories,
          teams: merged.teams,
          adjustmentLog: merged.adjustmentLog,
          currentTurnTeamId: merged.currentTurnTeamId,
          hasUnsavedChanges: false,
        });
      }
    },

    peekActiveSession: async (quizId: string) => {
      try {
        const response = await fetch(`/api/quiz-runs/active?quizId=${quizId}`);
        if (!response.ok) throw new Error("Failed to check for an active session");

        const { run } = await response.json();
        if (!run) return null;

        const live = liveStateFromRunState(run.final_state);
        const state = get();

        return {
          runId: run.id as string,
          startedAt: run.started_at as string,
          answered: live?.answeredKeys.length ?? 0,
          total: state.categories.reduce(
            (sum, c) => sum + c.questions.length,
            0
          ),
          teams: state.teams.map((t) => ({
            name: t.name,
            score: live?.scores[t.id] ?? t.score,
          })),
          hasProgress: hasSessionProgress(live),
        };
      } catch (error) {
        console.error("Error checking for an active session:", error);
        return null;
      }
    },

    completeSession: async (runId: string, quizId?: string) => {
```

- [ ] **Step 4: `completeSession` returns the saved run**

Find:

```ts
      const state = get();
      const sessionQuizId = quizId || state.activeQuizId;
      if (!sessionQuizId) return;
```

Replace with:

```ts
      const state = get();
      const sessionQuizId = quizId || state.activeQuizId;
      if (!sessionQuizId) return null;
```

Find:

```ts
        if (!response.ok) {
          throw new Error(`Kunne ikke fullføre økten (${response.status})`);
        }

        clearSnapshot(sessionQuizId);
```

Replace with:

```ts
        if (!response.ok) {
          throw new Error(`Kunne ikke fullføre økten (${response.status})`);
        }

        const { run } = await response.json();

        clearSnapshot(sessionQuizId);
```

Find (the tail of the `try` block — the exact last field in this `set()`
call depends on whether Del 2 has already landed: if so it reads
`roundStep: null,`; if not, it still reads `isQuestionOpen: false,`. Match
whichever is actually present):

```ts
          currentTurnTeamId: null,
          lastQuestion: null,
          roundStep: null,
        }));
      } catch (error) {
        console.error("Error completing session:", error);
        throw error;
      }
    },
```

Replace with:

```ts
          currentTurnTeamId: null,
          lastQuestion: null,
          roundStep: null,
        }));

        return run as QuizRun;
      } catch (error) {
        console.error("Error completing session:", error);
        throw error;
      }
    },
```

(If Del 2 has not landed yet, use `isQuestionOpen: false,` instead of
`roundStep: null,` in both the find and replace above — everything else in
this step is identical either way.)

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: passes (or fails only on pre-existing issues unrelated to this
task — none are expected, since every consumer of `completeSession`
already ignores or awaits its return value without asserting `void`).

- [ ] **Step 6: Commit**

```bash
git add utils/types.ts utils/store.ts
git commit -m "feat: add peekActiveSession, completeSession returns the saved run"
```

---

### Task 3: `hooks/useQuizBootstrap.ts` — the `resumable` status

**Files:**
- Modify: `hooks/useQuizBootstrap.ts`

**Interfaces:**
- Produces: `BootstrapState` gains a `"resumable"` member with `run:
  ActiveSessionSummary`, `resume: () => Promise<void>`, `startFresh: () =>
  Promise<void>`.
- Consumes: `peekActiveSession`, `restoreActiveSession`, `completeSession`
  (Task 2), `ActiveSessionSummary` (Task 2).

No unit test — this hook's own logic is now a thin sequencing of
already-tested pieces (`hasSessionProgress` via `peekActiveSession`); the
sequencing itself is DOM/timing-dependent (the run-counter cancellation
guard) and verified in Task 6 instead, same as before this plan.

- [ ] **Step 1: Replace the whole file**

```ts
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/utils/store";
import { templateFromQuizData } from "@/utils/quiz-template";
import { readPublicPlay } from "@/utils/live-snapshot";
import type { ActiveSessionSummary, QuizTheme } from "@/utils/types";

export type BootstrapState =
  | { status: "loading" }
  | { status: "ready"; quizId: string }
  | {
      status: "resumable";
      quizId: string;
      run: ActiveSessionSummary;
      /** Applies the paused session's scores and switches to "ready". */
      resume: () => Promise<void>;
      /**
       * Archives the paused session (it lands in history) and starts clean
       * — every team back to 0, every card playable again — then switches
       * to "ready".
       */
      startFresh: () => Promise<void>;
    }
  | { status: "empty" }
  | { status: "error"; message: string };

interface RawQuizPayload {
  quizId: string;
  quizOwnerId: string;
  quizTitle: string;
  quizDescription: string;
  quizTimeLimit: number | null;
  quizTheme: string;
  quizIsPublic: boolean;
  categories?: unknown;
  teams?: unknown;
  jokerTimeLimit?: unknown;
}

/**
 * Loads the board once, from one place.
 *
 * Both the game page and the editor need the same thing: the stored
 * template, plus whatever live session is running on top of it. A session
 * with real progress in it is never applied silently — hosting the same
 * quiz for a second group would otherwise pop the first group's scores and
 * checked-off cards onto the projector with no warning. Instead the caller
 * sees "resumable" and decides.
 *
 * Cancellation uses a run counter rather than a boolean: React's development
 * double-mount would otherwise let the first, abandoned load see the flag reset
 * by the second mount and apply its result as well, loading the quiz twice.
 */
export function useQuizBootstrap(): BootstrapState {
  const [state, setState] = useState<BootstrapState>(() => {
    const store = useGameStore.getState();
    return store.isHydrated && store.activeQuizId
      ? { status: "ready", quizId: store.activeQuizId }
      : { status: "loading" };
  });
  const runCounter = useRef(0);

  useEffect(() => {
    const myRun = ++runCounter.current;
    const isCurrent = () => runCounter.current === myRun;
    const store = useGameStore.getState();

    // Already loaded in this tab, for example navigating editor → game.
    if (store.isHydrated && store.activeQuizId) {
      setState({ status: "ready", quizId: store.activeQuizId });
      return;
    }

    const run = async () => {
      const publicQuizId = readPublicPlay();
      const url = publicQuizId
        ? `/api/quizzes/${publicQuizId}/load`
        : "/api/quiz";

      try {
        const response = await fetch(url);
        if (!isCurrent()) return;

        if (response.status === 404 || response.status === 403) {
          useGameStore.getState().setHydrated(true);
          setState({ status: "empty" });
          return;
        }
        if (response.status === 401) {
          setState({ status: "empty" });
          return;
        }
        if (!response.ok) {
          throw new Error(`Kunne ikke laste quiz (${response.status})`);
        }

        const { data } = (await response.json()) as { data: RawQuizPayload };
        if (!isCurrent()) return;

        const isPublicPlay = Boolean(publicQuizId);
        const template = templateFromQuizData(
          {
            categories: data.categories,
            teams: data.teams,
            jokerTimeLimit: data.jokerTimeLimit,
          },
          {
            quizTitle: data.quizTitle,
            quizDescription: data.quizDescription ?? "",
            quizTimeLimit: data.quizTimeLimit,
            quizTheme: normalizeTheme(data.quizTheme),
            quizIsPublic: data.quizIsPublic,
          }
        );

        useGameStore.getState().loadQuiz({
          template,
          quizId: data.quizId,
          quizOwnerId: data.quizOwnerId,
          isPublicPlay,
        });

        const quizId = data.quizId;
        const summary = await useGameStore.getState().peekActiveSession(quizId);
        if (!isCurrent()) return;

        if (!summary) {
          // No session at all. The board from loadQuiz() is already usable.
          setState({ status: "ready", quizId });
          return;
        }

        if (!summary.hasProgress) {
          // A session exists but nothing happened in it yet — apply it
          // silently, same as before there was a choice to make.
          await useGameStore.getState().restoreActiveSession(quizId);
          if (!isCurrent()) return;
          setState({ status: "ready", quizId });
          return;
        }

        setState({
          status: "resumable",
          quizId,
          run: summary,
          resume: async () => {
            await useGameStore.getState().restoreActiveSession(quizId);
            if (isCurrent()) setState({ status: "ready", quizId });
          },
          startFresh: async () => {
            await useGameStore.getState().completeSession(summary.runId, quizId);
            if (isCurrent()) setState({ status: "ready", quizId });
          },
        });
      } catch (error) {
        if (!isCurrent()) return;
        useGameStore.getState().setHydrated(true);
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Ukjent feil",
        });
      }
    };

    void run();
  }, []);

  return state;
}

function normalizeTheme(theme: string | null | undefined): QuizTheme {
  return theme === "modern" || theme === "christmas" ? theme : "classic";
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useQuizBootstrap.ts
git commit -m "feat: useQuizBootstrap reports a resumable session instead of applying it silently"
```

---

### Task 4: `app/page.tsx` — the resumable choice screen

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add the branch, right after the loading/empty skeleton block**

Find:

```tsx
  if (bootstrap.status === "loading" || bootstrap.status === "empty") {
    return (
      <main className="stage min-h-screen">
        <div className="container mx-auto p-8">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="h-10 w-1/2 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl bg-muted"
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (bootstrap.status === "error") {
```

Replace with:

```tsx
  if (bootstrap.status === "loading" || bootstrap.status === "empty") {
    return (
      <main className="stage min-h-screen">
        <div className="container mx-auto p-8">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="h-10 w-1/2 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl bg-muted"
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (bootstrap.status === "resumable") {
    const { run } = bootstrap;
    const started = new Date(run.startedAt);

    return (
      <main className="stage flex min-h-dvh items-center justify-center p-6">
        <div className="glass w-full max-w-xl rounded-2xl p-8">
          <h2 className="text-xl font-bold">En økt pågår allerede</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Startet{" "}
            {started.toLocaleString("nb-NO", {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            · {run.answered} av {run.total} kort spilt
          </p>

          {run.teams.length > 0 && (
            <ul className="mt-4 space-y-1">
              {run.teams.map((team) => (
                <li
                  key={team.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate">{team.name}</span>
                  <span className="font-bold tabular-nums text-accent">
                    {team.score}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => void bootstrap.resume()}>
              Fortsett økten
            </Button>
            <Button variant="outline" onClick={() => void bootstrap.startFresh()}>
              Start en ny økt med samme quiz
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await bootstrap.resume();
                router.push("/results");
              }}
            >
              Se resultatet fra økten som pågår
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Økten over lagres i historikken. Brettet nullstilles, og alle lag
            starter på 0.
          </p>
        </div>
      </main>
    );
  }

  if (bootstrap.status === "error") {
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: show a choice screen for a session with real progress"
```

---

### Task 5: `app/results/page.tsx` — the finale

**Files:**
- Modify: `app/results/page.tsx` (full file)

**Interfaces:**
- Consumes: `formatDuration`, `formatRunDate` from `@/utils/format`
  (already exist, unused by this file today — confirmed by reading it).
  `QuizRun`, `TeamResult` from `@/utils/types`.

- [ ] **Step 1: Replace the whole file**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/utils/store";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Crown,
  Minimize2,
  Tv,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { rankTeams } from "@/utils/ranking";
import { countQuestions } from "@/utils/quiz-template";
import { formatDuration } from "@/utils/format";
import { useQuizBootstrap } from "@/hooks/useQuizBootstrap";
import { usePresentationMode } from "@/hooks/usePresentationMode";
import type { QuizRun } from "@/utils/types";

/** Names printed on one podium step before it collapses to a count. */
const PODIUM_NAMES = 3;

interface DisplayTeam {
  id: string;
  name: string;
  score: number;
  rank: number;
  players: string[];
}

/**
 * The finale, sized for the room rather than for the host's screen.
 *
 * Once a session is saved, completeSession() resets the store's live
 * scores to 0 — that's correct for the board, which needs to come back
 * clean, but it means this page can't keep reading `teams`/`categories`
 * afterward. The server's response to the complete call (duration,
 * per-team results, answered count) is kept in savedRun instead, and every
 * number on screen prefers it once it exists.
 */
export default function Results() {
  const router = useRouter();
  const bootstrap = useQuizBootstrap();
  const presentation = usePresentationMode();
  const teams = useGameStore((s) => s.teams);
  const categories = useGameStore((s) => s.categories);
  const activeRunId = useGameStore((s) => s.activeRunId);
  const completeSession = useGameStore((s) => s.completeSession);
  const quizTitle = useGameStore((s) => s.quizTitle);

  const [isCompleting, setIsCompleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedRun, setSavedRun] = useState<QuizRun | null>(null);

  // A results page's only job is the live numbers — never make the host
  // choose here, just apply whatever session is waiting.
  useEffect(() => {
    if (bootstrap.status === "resumable") void bootstrap.resume();
  }, [bootstrap]);

  const liveRanked = useMemo(() => rankTeams(teams), [teams]);

  const ranked: DisplayTeam[] = savedRun
    ? savedRun.team_results.map((r) => ({
        id: r.teamId,
        name: r.teamName,
        score: r.finalScore,
        rank: r.rank,
        players: [],
      }))
    : liveRanked;

  const hasTeams = ranked.length > 0;
  const total = savedRun ? savedRun.total_questions : countQuestions(categories);
  const answered = savedRun
    ? savedRun.answered_questions
    : categories.reduce(
        (sum, c) => sum + c.questions.filter((q) => q.answered).length,
        0
      );

  const groups = useMemo(() => {
    const byRank: Record<number, DisplayTeam[]> = {};
    for (const team of ranked) {
      if (!byRank[team.rank]) byRank[team.rank] = [];
      byRank[team.rank].push(team);
    }
    return byRank;
  }, [ranked]);

  const ranksToShow = [1, 2, 3].filter((rank) => groups[rank]?.length);
  const topScore = ranked[0]?.score ?? 0;

  const handleComplete = async () => {
    if (!activeRunId) return;
    setIsCompleting(true);
    try {
      const run = await completeSession(activeRunId);
      setSavedRun(run);
      toast({
        title: "Økten er lagret",
        description: "Du finner den under Historikk.",
      });
    } catch (error) {
      toast({
        title: "Kunne ikke fullføre økten",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
      setConfirmOpen(false);
    }
  };

  // Heights in vh so the podium keeps its proportions on a projector instead of
  // shrinking to a fifth of the screen.
  const heightForRank = (rank: number) => {
    const score = groups[rank]?.[0]?.score ?? 0;
    const min = 8;
    const max = 26;
    if (topScore <= 0) return `${min}vh`;
    const fraction = Math.max(0, Math.min(1, score / topScore));
    return `${(min + (max - min) * fraction).toFixed(1)}vh`;
  };

  const colorForRank = (rank: number) =>
    rank === 1 ? "bg-accent" : rank === 2 ? "bg-muted" : "bg-secondary";

  // Gold and light silver read a dark digit; dark bronze needs a light one
  // — a single text-background/70 for all three vanished on two of them.
  const digitColorForRank = (rank: number) =>
    rank <= 2 ? "text-foreground/80" : "text-background/80";

  // The classic silver-gold-bronze arrangement only reads as a podium when all
  // three steps are there. With two, it put the winner on the right and the
  // runner-up on the left, which reads as the opposite of what happened.
  const orderForRank = (rank: number) => {
    if (ranksToShow.length < 3) return "order-none";
    return rank === 1 ? "order-2" : rank === 2 ? "order-1" : "order-3";
  };

  if (bootstrap.status === "loading" || bootstrap.status === "resumable") {
    return (
      <div className="stage min-h-dvh p-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="mx-auto h-12 w-64 animate-pulse rounded bg-muted" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (bootstrap.status === "error") {
    return (
      <div className="stage flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold">Kunne ikke laste resultatene</h1>
        <p className="text-muted-foreground">{bootstrap.message}</p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Prøv igjen</Button>
          <Button variant="outline" onClick={() => router.push("/quizzes")}>
            Til biblioteket
          </Button>
        </div>
      </div>
    );
  }

  if (bootstrap.status === "empty") {
    return (
      <div className="stage flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold">Ingen quiz å vise resultater for</h1>
        <p className="text-muted-foreground">
          Denne lenken peker ikke på en quiz du har tilgang til lenger.
        </p>
        <Button onClick={() => router.push("/quizzes")}>Til biblioteket</Button>
      </div>
    );
  }

  return (
    <div className="stage min-h-dvh px-4 pb-10 pt-3 text-foreground sm:px-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        {presentation.active ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-2"
            onClick={presentation.exit}
            title="Tilbake til vertens visning"
          >
            <Minimize2 className="h-4 w-4" />
            <span className="hidden sm:inline">Avslutt</span>
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Tilbake til brettet
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={presentation.enter}
              className="gap-2"
              title="Fullskjerm uten verktøylinje — for projektoren"
            >
              <Tv className="h-4 w-4" />
              <span className="hidden sm:inline">Salen</span>
            </Button>
          </>
        )}
      </div>

      <header className="mb-6 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground sm:text-sm">
          {quizTitle || "Uten navn"}
        </p>
        <h1 className="text-[clamp(2rem,7vh,4.5rem)] font-extrabold tracking-tight text-accent drop-shadow-sm">
          RESULTATER
        </h1>
        {total > 0 && (
          <p className="text-xs text-muted-foreground sm:text-sm">
            {answered} av {total} spørsmål spilt
            {savedRun && (
              <>
                {" "}
                · {formatDuration(savedRun.duration_seconds)} ·{" "}
                {new Date(savedRun.ended_at ?? Date.now()).toLocaleDateString(
                  "nb-NO",
                  { day: "numeric", month: "long" }
                )}
              </>
            )}
          </p>
        )}
      </header>

      {!hasTeams ? (
        <p className="text-center text-muted-foreground">
          Ingen lag i denne økten.
        </p>
      ) : (
        <>
          <section className="mb-10">
            <div className="mx-auto flex w-full max-w-5xl items-end justify-center gap-3 sm:gap-6">
              {ranksToShow.map((rank) => (
                <div
                  key={`rank-${rank}`}
                  className={`flex min-w-0 flex-1 flex-col items-center ${orderForRank(rank)}`}
                >
                  <div className="z-10 mb-2 w-full text-center">
                    {rank === 1 && (
                      <Crown
                        className="mx-auto mb-1 h-[clamp(1.5rem,4vh,3rem)] w-[clamp(1.5rem,4vh,3rem)] text-accent"
                        aria-hidden
                      />
                    )}
                    <div className="flex flex-col items-center gap-1">
                      {/* Capped: eight teams on nil all share rank 2, and
                          naming every one of them on the step made the column
                          taller than the podium it stood on. The rest are in
                          the standings underneath. */}
                      {groups[rank].slice(0, PODIUM_NAMES).map((team) => (
                        <div key={team.id} className="w-full min-w-0">
                          <p
                            className={`truncate font-bold leading-tight ${
                              rank === 1
                                ? "text-[clamp(1.1rem,3.6vh,2.6rem)]"
                                : "text-[clamp(0.9rem,2.5vh,1.6rem)]"
                            }`}
                            title={team.name}
                          >
                            {team.name}
                          </p>
                          <p
                            className={`font-extrabold tabular-nums text-accent ${
                              rank === 1
                                ? "text-[clamp(1.3rem,4.4vh,3.2rem)]"
                                : "text-[clamp(1rem,3vh,2rem)]"
                            }`}
                          >
                            {team.score}
                          </p>
                        </div>
                      ))}
                      {groups[rank].length > PODIUM_NAMES && (
                        <p className="text-xs text-muted-foreground sm:text-sm">
                          +{groups[rank].length - PODIUM_NAMES} flere
                        </p>
                      )}
                    </div>
                  </div>
                  <div
                    className={`flex w-full items-start justify-center rounded-t-xl border border-border pt-2 shadow-2xl ${colorForRank(
                      rank,
                    )}`}
                    style={{ height: heightForRank(rank) }}
                  >
                    <span
                      className={`text-[clamp(1.25rem,3.6vh,2.75rem)] font-black ${digitColorForRank(rank)}`}
                    >
                      {rank}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {ranked.length > ranksToShow.length && (
            <section className="mx-auto max-w-3xl">
              <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {ranked.map((team) => (
                  <li
                    key={team.id}
                    className="flex items-center justify-between gap-3 bg-popover/40 px-4 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={[
                          "w-8 shrink-0 text-center text-lg font-bold tabular-nums",
                          team.rank === 1
                            ? "text-accent"
                            : team.rank === 2
                              ? "text-muted-foreground"
                              : team.rank === 3
                                ? "text-secondary"
                                : "text-foreground/70",
                        ].join(" ")}
                      >
                        {team.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-base font-medium sm:text-lg">
                          {team.name}
                        </p>
                        {team.players.length > 0 && (
                          <p className="truncate text-xs text-muted-foreground">
                            {team.players.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-xl font-bold tabular-nums text-accent sm:text-2xl">
                      {team.score}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      <div className="mx-auto mt-10 flex max-w-3xl flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
        <span
          className={
            savedRun
              ? "inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success"
              : "inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive"
          }
        >
          {savedRun ? (
            <>
              <CheckCircle className="h-3.5 w-3.5" />
              Lagret i historikken kl.{" "}
              {new Date(savedRun.ended_at ?? Date.now()).toLocaleTimeString(
                "nb-NO",
                { hour: "2-digit", minute: "2-digit" }
              )}
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5" />
              Ikke lagret ennå
            </>
          )}
        </span>

        <div className="flex flex-wrap justify-center gap-2">
          {savedRun ? (
            <>
              <Button onClick={() => router.push("/")}>
                Spill denne quizen igjen
              </Button>
              <Button variant="outline" onClick={() => router.push("/history")}>
                Se økten i historikken
              </Button>
              <Button variant="ghost" onClick={() => router.push("/quizzes")}>
                Til biblioteket
              </Button>
            </>
          ) : hasTeams && activeRunId ? (
            <Button onClick={() => setConfirmOpen(true)} disabled={isCompleting}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {isCompleting ? "Fullfører…" : "Fullfør og lagre økten"}
            </Button>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              <p>Ingen aktiv økt å lagre.</p>
              <p>
                Åpne{" "}
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => router.push("/")}
                >
                  brettet
                </button>{" "}
                og spill minst ett spørsmål for å starte en økt.
              </p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fullføre økten?</AlertDialogTitle>
            <AlertDialogDescription>
              Resultatet lagres i historikken, og brettet nullstilles så quizen
              er klar til neste gang. Poengene finner du igjen under Historikk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete}>
              Fullfør
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/results/page.tsx
git commit -m "feat: results handles error/empty/resumable and a saved-session receipt"
```

---

### Task 6: Verify in the running app

No component-test infrastructure exists (see Del 1's Task 2 note) — this is
a browser verification task.

**Files:** none — verification only.

- [ ] **Step 1: Resumable choice screen**

Start a session (play at least one question), leave `/`, reopen it (a
second tab or a reload after re-navigating). Confirm the choice screen
shows the right "X av Y kort spilt" and per-team scores, that "Fortsett
økten" restores exactly that state onto the board, and that "Start en ny
økt" archives the old one (check it now appears in `/history`) and hands
back a blank board (all scores 0, all cards playable).

- [ ] **Step 2: Silent resume for an empty session**

Open a quiz, let a run get created (any question click, per
`RoundScreenBody`'s `startSession` effect from Del 2 — or, if Del 2 isn't
in yet, opening `QuestionModal`) but answer nothing, then reload. Confirm
it resumes straight to "ready" with no prompt.

- [ ] **Step 3: Results — error, empty, and resumable**

Simulate an error state (e.g. throttle/kill the network for the initial
`/api/quiz` request) and confirm the new error screen with "Prøv igjen"
appears. Visit `/results` for a quiz you don't own or that doesn't exist
and confirm the empty-state screen. Visit `/results` while a session with
progress is active elsewhere and confirm it resumes silently (no choice
screen) and shows the live numbers.

- [ ] **Step 4: Results — the saved receipt**

Play a short session, go to `/results`, click "Fullfør og lagre økten",
confirm in the dialog. Confirm: the status chip switches from "Ikke lagret
ennå" (destructive) to "Lagret i historikken kl. HH:MM" (success); the
podium and standings still show the right teams/scores/ranks (not blank);
the subtitle now includes duration and date; the action row now shows
"Spill denne quizen igjen" / "Se økten i historikken" / "Til biblioteket".
Click "Spill denne quizen igjen" and confirm it lands on a fresh board for
the same quiz.

- [ ] **Step 5: Podium digit contrast across all three themes**

Switch the quiz's theme between classic/modern/christmas (via quiz
settings) and check the rank digit on each of the three podium steps is
legible against its own background in every theme. Adjust
`digitColorForRank` in `app/results/page.tsx` if any combination fails —
this is flagged as unverified-by-construction in this plan's Assumptions.

- [ ] **Step 6: Run the full test suite, type-check, and build**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all tests pass (including the new `session-progress` suite), no
type errors, build succeeds.

- [ ] **Step 7: Commit if Steps 1-5 required any fixes**

```bash
git add -A
git commit -m "fix: session/results verification fixes"
```

(Skip this commit if no fixes were needed.)

---

## Self-Review Notes

- **Spec coverage:** Del 3's new bootstrap status, resumable-only-with-
  progress rule, choice screen copy/actions, and "start fresh completes the
  old run first" are covered (Tasks 1, 3, 4). Del 4's six numbered items are
  covered: error/empty handling (Task 5), status chip (Task 5), bottom
  action row for both save states (Task 5), "ingen aktiv økt" replaced with
  an explanation and a way forward (Task 5), podium digit contrast (Task 5,
  verified in Task 6), duration+date subtitle (Task 5). `heightForRank` is
  untouched, as instructed.
- **Placeholder scan:** clean — every step is either literal file content
  or an exact find/replace.
- **Type consistency:** `ActiveSessionSummary`'s fields
  (`runId`/`startedAt`/`answered`/`total`/`teams`/`hasProgress`) match
  between its `types.ts` declaration, `store.ts`'s `peekActiveSession`
  return value, and `useQuizBootstrap.ts`'s `resumable` status and its use
  in `app/page.tsx` — checked, no drift. `QuizRun`'s fields used in
  `app/results/page.tsx` (`team_results`, `total_questions`,
  `answered_questions`, `duration_seconds`, `ended_at`) all match the
  existing `QuizRun` interface in `types.ts` (verified against the actual
  interface, not assumed).
