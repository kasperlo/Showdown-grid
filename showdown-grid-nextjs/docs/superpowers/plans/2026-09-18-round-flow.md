# Round Flow (Del 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the question-modal-plus-bottom-dock pattern with a single
full-page round takeover, driven by a `roundStep` state machine
(`question → answer → award → awarded`), and add `undoLastAward()`.

**Architecture:** `isQuestionOpen: boolean` becomes `roundStep: RoundStep`
in the store — the store is the state machine, components only read it and
call the transition actions (`advanceRoundStep`, `awardPositive`,
`awardNegative`, `endRound`, `cancelRound`, `undoLastAward`). A single new
component tree, `components/round/RoundScreen.tsx`, renders whichever step
is active; `GameStage` mounts it in place of the whole board layout
(`if (roundStep) return <RoundScreen />;`) rather than layering a dialog on
top of the board — the board's own state lives in the store, so it's safe
to unmount it for the duration of a round. `QuestionModal.tsx` and
`RoundDock.tsx` are deleted outright, not deprecated.

**Tech Stack:** Next.js (App Router), React, Zustand, Tailwind CSS, vitest
(node environment). Zustand's `create()` store has no DOM/fetch
dependencies in the round-flow actions themselves (verified below), so this
part's state machine gets real tests — unlike Del 1, which had none.

**Spec:** [docs/superpowers/specs/2026-09-18-redesign-spillmodus.md](../specs/2026-09-18-redesign-spillmodus.md)
— "Del 2 — Runden i fire steg" and the shared "Fallgruver" section
(especially 1 and 2, which this part must not regress).

**Depends on:** [2026-09-18-board-geometry.md](2026-09-18-board-geometry.md)
(Del 1) should land first per the spec's Rekkefølge, but this plan does not
technically require any of its files — it only reads `GameStage.tsx`'s
board-rendering branch, which it otherwise leaves untouched.

## Global Constraints

- Keyboard bindings (verbatim from spec):
  - `Space` — `question → answer → award`
  - `1`–`9` — award points to team n (`award` step only)
  - `Shift`+`1`–`9` — penalize team n (`award` step only)
  - `N` — end the round (`award` and `awarded` steps only)
  - `Escape` — cancel the round, no points (`question` step only)
- One `useEffect` per step, each with its own `keydown` handler. Every
  handler re-checks the *current* `roundStep` by reading
  `useGameStore.getState().roundStep` at call time — not just relying on
  the effect's dependency array — and ignores `event.repeat`. This is
  fallgruve 1 from the spec: a keystroke in flight when the step changes
  must not reach the wrong step's handler.
- `EmojiBurst` mounts once at `RoundScreen`'s root, not per step, so it
  survives the step transition it's celebrating.
- The whole round content remounts (via a React `key`) when `lastQuestion`
  changes identity (`${categoryName}-${questionIndex}`) — this is fallgruve
  2: local state (the joker countdown, the award step's points stepper)
  resets by remounting, not by an effect trying to undo the previous
  question's state.
- Do not touch the board layout branch of `GameStage.tsx` beyond swapping
  `isQuestionOpen` for `roundStep` — Del 1's geometry/centering work stays
  as it is.

## Assumptions (call out, not silent)

1. **Every award now logs an adjustment entry**, not just non-default
   custom-point ones (previously `awardPositive`/`awardNegative` only
   pushed to `adjustmentLog` when `customPoints` differed from the
   default). This is required for `undoLastAward()` to have something to
   pop, and is an explicit spec requirement ("Tildelingen legger en
   oppføring i adjustmentLog som undo popper"). `AdjustmentEntry.type`
   gains two members, `"award"` and `"penalty"`, alongside the existing
   `"manual"` and `"custom_scoring"` (kept for when the award amount is
   edited away from both defaults). Verified by grep that nothing does an
   exhaustive switch on `.type` elsewhere in the repo, so this is safe to
   extend.
2. **`GameBoard.tsx` needs a two-line fix not in the spec's file list**: it
   directly imports and renders `<QuestionModal />` at the end of its JSX
   (verified by reading the file). Deleting `QuestionModal.tsx` without
   removing that reference breaks the build. Fixed in Task 5.
3. **The `award`→`awarded` transition only happens on a *positive* award.**
   A penalty (`awardNegative`) keeps `roundStep` at `"award"` — a host can
   dock several teams before anyone gets it right. This matches the
   existing guard shape (`awardNegative` already refuses once
   `round.positiveTeamId` is set) and the spec's "awarded" receipt copy,
   which only describes a correct-answer outcome.
4. **`undoLastAward()` only works from the `awarded` step**, and only
   undoes the entry that produced it (the top of `adjustmentLog`, which is
   always the positive award right after `awardPositive` runs). It also
   reverses the "mark the card answered" side effect and clears
   `round.positiveTeamId`, putting the state machine back exactly where
   `award` left off. The spec only asks for score reversal ("ta laget
   tilbake til forrige sum"); reverting the card's answered flag and
   `round.positiveTeamId` too is necessary for "uten å avslutte runden" to
   actually mean the round is still live and awardable, not just that
   `roundStep` says so.
5. **No "go back" controls beyond what the spec lists.** The original
   `QuestionModal` had a "Skjul svar" button to flip back from a revealed
   answer; the new `answer` step has no such control, and jokers have no
   "Avslutt runden" escape hatch while their countdown runs (only `Escape`,
   which cancels with no points and leaves the card unplayed — the
   joker-specific early-exit-with-no-score option is gone, since spec's
   `N` binding is explicitly scoped to `award`/`awarded` only, not
   `question`). If a host wants "nobody solved this", they now reach
   `award` first, then press `N` there — one extra step for that one case.

---

### Task 1: `utils/types.ts` + `utils/store.ts` — the `roundStep` state machine

**Files:**
- Modify: `utils/types.ts`
- Modify: `utils/store.ts`
- Test: `utils/__tests__/store-round-flow.test.ts`

**Interfaces:**
- Produces: `RoundStep = "question" | "answer" | "award" | "awarded" |
  null` (exported from `utils/types.ts`). `GameState.roundStep: RoundStep`
  replaces `isQuestionOpen: boolean`. New actions:
  `advanceRoundStep(): void`, `cancelRound(): void`, `undoLastAward():
  void`. `setQuestionOpen` is removed.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "../store";
import type { Category, Team } from "../types";

function fixtureCategories(): Category[] {
  return [
    {
      name: "Mat",
      questions: [
        {
          points: 100,
          question: "Hva er fårikål?",
          answer: "Kjøtt og kål",
          answered: false,
        },
      ],
    },
  ];
}

function fixtureTeams(): Team[] {
  return [
    { id: "a", name: "Alfa", score: 900, players: [] },
    { id: "b", name: "Bravo", score: 300, players: [] },
  ];
}

beforeEach(() => {
  useGameStore.setState({
    categories: fixtureCategories(),
    teams: fixtureTeams(),
    lastQuestion: null,
    roundStep: null,
    round: { active: false, positiveTeamId: null, negativeAwardedTo: [] },
    adjustmentLog: [],
    currentTurnTeamId: null,
    isInitialTurnSelection: false,
  });
});

function openFirstQuestion() {
  useGameStore.getState().setLastQuestion({
    categoryName: "Mat",
    questionIndex: 0,
    points: 100,
    question: "Hva er fårikål?",
    answer: "Kjøtt og kål",
  });
}

describe("round flow", () => {
  it("opens a question into the question step", () => {
    openFirstQuestion();
    expect(useGameStore.getState().roundStep).toBe("question");
  });

  it("advances question -> answer -> award for a normal card", () => {
    openFirstQuestion();
    useGameStore.getState().advanceRoundStep();
    expect(useGameStore.getState().roundStep).toBe("answer");
    useGameStore.getState().advanceRoundStep();
    expect(useGameStore.getState().roundStep).toBe("award");
  });

  it("skips the answer step for a joker card", () => {
    useGameStore.getState().setLastQuestion({
      categoryName: "Mat",
      questionIndex: 0,
      points: 100,
      question: "",
      answer: "",
      isJoker: true,
      jokerTask: "Gjør ti hopp",
    });
    useGameStore.getState().advanceRoundStep();
    expect(useGameStore.getState().roundStep).toBe("award");
  });

  it("Escape from the question step cancels without marking the card played", () => {
    openFirstQuestion();
    useGameStore.getState().cancelRound();

    const state = useGameStore.getState();
    expect(state.roundStep).toBeNull();
    expect(state.lastQuestion).toBeNull();
    expect(state.categories[0].questions[0].answered).toBe(false);
  });

  it("awards points, marks the card played, and moves to the awarded step", () => {
    openFirstQuestion();
    useGameStore.getState().advanceRoundStep();
    useGameStore.getState().advanceRoundStep();
    useGameStore.getState().awardPositive("a", 100);

    const state = useGameStore.getState();
    expect(state.roundStep).toBe("awarded");
    expect(state.teams.find((t) => t.id === "a")?.score).toBe(1000);
    expect(state.categories[0].questions[0].answered).toBe(true);
    expect(state.adjustmentLog[0]).toMatchObject({ teamId: "a", delta: 100 });
  });

  it("N (endRound) from the awarded step ends the round with the points kept", () => {
    openFirstQuestion();
    useGameStore.getState().advanceRoundStep();
    useGameStore.getState().advanceRoundStep();
    useGameStore.getState().awardPositive("a", 100);

    useGameStore.getState().endRound();

    const state = useGameStore.getState();
    expect(state.roundStep).toBeNull();
    expect(state.lastQuestion).toBeNull();
    expect(state.teams.find((t) => t.id === "a")?.score).toBe(1000);
    expect(state.currentTurnTeamId).toBe("a");
  });

  it("undoLastAward takes the team back to its previous sum and reopens the award step", () => {
    openFirstQuestion();
    useGameStore.getState().advanceRoundStep();
    useGameStore.getState().advanceRoundStep();
    useGameStore.getState().awardPositive("a", 100);

    useGameStore.getState().undoLastAward();

    const state = useGameStore.getState();
    expect(state.teams.find((t) => t.id === "a")?.score).toBe(900);
    expect(state.roundStep).toBe("award");
    expect(state.round.positiveTeamId).toBeNull();
    expect(state.categories[0].questions[0].answered).toBe(false);
    expect(state.adjustmentLog).toHaveLength(0);
  });

  it("awardNegative penalizes without ending the award step, for more than one team", () => {
    openFirstQuestion();
    useGameStore.getState().advanceRoundStep();
    useGameStore.getState().advanceRoundStep();

    useGameStore.getState().awardNegative("a");
    useGameStore.getState().awardNegative("b");

    const state = useGameStore.getState();
    expect(state.roundStep).toBe("award");
    expect(state.teams.find((t) => t.id === "a")?.score).toBe(850);
    expect(state.teams.find((t) => t.id === "b")?.score).toBe(250);
    expect(state.round.negativeAwardedTo).toEqual(["a", "b"]);
  });

  it("blocks awarding before the award step is reached", () => {
    openFirstQuestion();
    useGameStore.getState().awardPositive("a", 100);

    expect(useGameStore.getState().teams.find((t) => t.id === "a")?.score).toBe(
      900
    );
    expect(useGameStore.getState().roundStep).toBe("question");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- store-round-flow`
Expected: FAIL — `roundStep`/`advanceRoundStep`/`cancelRound`/
`undoLastAward` don't exist yet (type errors and/or `undefined is not a
function`).

- [ ] **Step 3: `utils/types.ts` — add `RoundStep`, update `GameState`**

Find:

```ts
export interface RoundProgress {
  active: boolean;
  positiveTeamId: string | null;
  negativeAwardedTo: string[];
}

export interface AdjustmentEntry {
  id: string;
  teamId: string;
  teamNameSnapshot: string;
  delta: number;
  reason?: string;
  createdAt: number;
  type: "manual" | "custom_scoring";
}
```

Replace with:

```ts
export interface RoundProgress {
  active: boolean;
  positiveTeamId: string | null;
  negativeAwardedTo: string[];
}

/**
 * A round's four screens: question -> answer -> award -> awarded. A joker
 * card skips answer, going straight from question to award.
 */
export type RoundStep = "question" | "answer" | "award" | "awarded" | null;

export interface AdjustmentEntry {
  id: string;
  teamId: string;
  teamNameSnapshot: string;
  delta: number;
  reason?: string;
  createdAt: number;
  type: "manual" | "custom_scoring" | "award" | "penalty";
}
```

Find:

```ts
  lastQuestion: LastQuestion | null;
  isQuestionOpen: boolean;
  round: RoundProgress;
```

Replace with:

```ts
  lastQuestion: LastQuestion | null;
  roundStep: RoundStep;
  round: RoundProgress;
```

Find:

```ts
  setLastQuestion: (question: LastQuestion | null) => void;
  setQuestionOpen: (open: boolean) => void;
```

Replace with:

```ts
  setLastQuestion: (question: LastQuestion | null) => void;
  /** question -> answer -> award (joker cards skip answer). */
  advanceRoundStep: () => void;
  /** Escape from the question step: no points, the card stays unplayed. */
  cancelRound: () => void;
```

Find:

```ts
  manualAdjustScore: (teamId: string, delta: number, reason?: string) => void;
  undoLastAdjustment: () => void;
```

Replace with:

```ts
  manualAdjustScore: (teamId: string, delta: number, reason?: string) => void;
  undoLastAdjustment: () => void;
  /** Reverses the award that took the round to "awarded", from there only. */
  undoLastAward: () => void;
```

- [ ] **Step 4: `utils/store.ts` — swap `isQuestionOpen` for `roundStep` everywhere**

Import the new type. Find:

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
  RoundStep,
} from "./types";
```

Find (the `setLastQuestion`/`setQuestionOpen` pair):

```ts
    setLastQuestion: (question: LastQuestion | null) => {
      set({
        lastQuestion: question,
        isQuestionOpen: !!question,
        round: question
          ? { ...initialRoundState(), active: true }
          : initialRoundState(),
      });
    },

    setQuestionOpen: (open: boolean) => set({ isQuestionOpen: open }),
```

Replace with:

```ts
    setLastQuestion: (question: LastQuestion | null) => {
      set({
        lastQuestion: question,
        roundStep: question ? "question" : null,
        round: question
          ? { ...initialRoundState(), active: true }
          : initialRoundState(),
      });
    },

    advanceRoundStep: () => {
      set((state) => {
        if (state.roundStep === "question") {
          return {
            roundStep: state.lastQuestion?.isJoker ? "award" : "answer",
          };
        }
        if (state.roundStep === "answer") return { roundStep: "award" };
        return state;
      });
    },

    cancelRound: () => {
      set({ lastQuestion: null, roundStep: null, round: initialRoundState() });
    },
```

Find, in `resetGame()`:

```ts
        lastQuestion: null,
        isQuestionOpen: false,
        round: initialRoundState(),
        adjustmentLog: [],
        currentTurnTeamId: null,
        isInitialTurnSelection: false,
        activeRunId: null,
        currentRunStartTime: null,
      });
    },

    awardPositive: (teamId: string, customPoints?: number) => {
      const { lastQuestion, round, adjustmentLog, teams } = get();
      if (!lastQuestion || round.positiveTeamId) return;

      const pointsToAward = customPoints ?? lastQuestion.points;
      const team = teams.find((t) => t.id === teamId);

      get().markQuestionAsAnswered(
        lastQuestion.categoryName,
        lastQuestion.questionIndex
      );

      let newAdjustmentLog = adjustmentLog;
      if (
        customPoints !== undefined &&
        customPoints !== lastQuestion.points &&
        team
      ) {
        const entry: AdjustmentEntry = {
          id: genId(),
          teamId,
          teamNameSnapshot: team.name,
          delta: customPoints,
          reason: `Custom scoring på ${lastQuestion.categoryName} (${lastQuestion.points} poeng)`,
          createdAt: Date.now(),
          type: "custom_scoring",
        };
        newAdjustmentLog = [entry, ...adjustmentLog];
      }

      set((state) => ({
        teams: state.teams.map((t) =>
          t.id === teamId ? { ...t, score: t.score + pointsToAward } : t
        ),
        round: { ...state.round, positiveTeamId: teamId },
        adjustmentLog: newAdjustmentLog,
      }));
      snapshotLiveState();
    },

    awardNegative: (teamId: string, customPoints?: number) => {
      const { lastQuestion, round, adjustmentLog, teams } = get();
      if (
        !lastQuestion ||
        round.positiveTeamId ||
        round.negativeAwardedTo.includes(teamId)
      )
        return;

      const defaultPenalty = -Math.round(lastQuestion.points * 0.5);
      const penalty = customPoints ?? defaultPenalty;
      const team = teams.find((t) => t.id === teamId);

      let newAdjustmentLog = adjustmentLog;
      if (
        customPoints !== undefined &&
        customPoints !== defaultPenalty &&
        team
      ) {
        const entry: AdjustmentEntry = {
          id: genId(),
          teamId,
          teamNameSnapshot: team.name,
          delta: customPoints,
          reason: `Custom penalty på ${lastQuestion.categoryName} (standard: ${defaultPenalty})`,
          createdAt: Date.now(),
          type: "custom_scoring",
        };
        newAdjustmentLog = [entry, ...adjustmentLog];
      }

      set((state) => ({
        teams: state.teams.map((t) =>
          t.id === teamId ? { ...t, score: t.score + penalty } : t
        ),
        round: {
          ...state.round,
          negativeAwardedTo: [...state.round.negativeAwardedTo, teamId],
        },
        adjustmentLog: newAdjustmentLog,
      }));
      snapshotLiveState();
    },

    endRound: () => {
      const { round, lastQuestion } = get();
      if (round.active && lastQuestion) {
        get().markQuestionAsAnswered(
          lastQuestion.categoryName,
          lastQuestion.questionIndex
        );
      }

      const winner = round.positiveTeamId;
      set({
        lastQuestion: null,
        isQuestionOpen: false,
        round: initialRoundState(),
      });
```

Replace with:

```ts
        lastQuestion: null,
        roundStep: null,
        round: initialRoundState(),
        adjustmentLog: [],
        currentTurnTeamId: null,
        isInitialTurnSelection: false,
        activeRunId: null,
        currentRunStartTime: null,
      });
    },

    awardPositive: (teamId: string, customPoints?: number) => {
      const { lastQuestion, round, roundStep, adjustmentLog, teams } = get();
      if (!lastQuestion || round.positiveTeamId || roundStep !== "award")
        return;

      const team = teams.find((t) => t.id === teamId);
      if (!team) return;

      const pointsToAward = customPoints ?? lastQuestion.points;

      get().markQuestionAsAnswered(
        lastQuestion.categoryName,
        lastQuestion.questionIndex
      );

      const entry: AdjustmentEntry = {
        id: genId(),
        teamId,
        teamNameSnapshot: team.name,
        delta: pointsToAward,
        reason: `Riktig svar på ${lastQuestion.categoryName} (${lastQuestion.points} poeng)`,
        createdAt: Date.now(),
        type:
          customPoints !== undefined && customPoints !== lastQuestion.points
            ? "custom_scoring"
            : "award",
      };

      set((state) => ({
        teams: state.teams.map((t) =>
          t.id === teamId ? { ...t, score: t.score + pointsToAward } : t
        ),
        round: { ...state.round, positiveTeamId: teamId },
        adjustmentLog: [entry, ...adjustmentLog],
        roundStep: "awarded",
      }));
      snapshotLiveState();
    },

    awardNegative: (teamId: string, customPoints?: number) => {
      const { lastQuestion, round, roundStep, adjustmentLog, teams } = get();
      if (
        !lastQuestion ||
        round.positiveTeamId ||
        round.negativeAwardedTo.includes(teamId) ||
        roundStep !== "award"
      )
        return;

      const team = teams.find((t) => t.id === teamId);
      if (!team) return;

      const defaultPenalty = -Math.round(lastQuestion.points * 0.5);
      const penalty = customPoints ?? defaultPenalty;

      const entry: AdjustmentEntry = {
        id: genId(),
        teamId,
        teamNameSnapshot: team.name,
        delta: penalty,
        reason: `Feil svar på ${lastQuestion.categoryName} (standard: ${defaultPenalty})`,
        createdAt: Date.now(),
        type:
          customPoints !== undefined && customPoints !== defaultPenalty
            ? "custom_scoring"
            : "penalty",
      };

      set((state) => ({
        teams: state.teams.map((t) =>
          t.id === teamId ? { ...t, score: t.score + penalty } : t
        ),
        round: {
          ...state.round,
          negativeAwardedTo: [...state.round.negativeAwardedTo, teamId],
        },
        adjustmentLog: [entry, ...adjustmentLog],
      }));
      snapshotLiveState();
    },

    undoLastAward: () => {
      const { adjustmentLog, roundStep, lastQuestion, round } = get();
      const last = adjustmentLog[0];
      if (!last || roundStep !== "awarded" || !lastQuestion) return;

      const wasPositiveAward = round.positiveTeamId === last.teamId;

      set((state) => ({
        teams: state.teams.map((t) =>
          t.id === last.teamId ? { ...t, score: t.score - last.delta } : t
        ),
        adjustmentLog: state.adjustmentLog.slice(1),
        round: {
          ...state.round,
          positiveTeamId: wasPositiveAward ? null : state.round.positiveTeamId,
          negativeAwardedTo: state.round.negativeAwardedTo.filter(
            (id) => id !== last.teamId
          ),
        },
        roundStep: "award",
      }));

      if (wasPositiveAward) {
        get().toggleQuestionAnswered(
          lastQuestion.categoryName,
          lastQuestion.questionIndex,
          false
        );
      }

      snapshotLiveState();
    },

    endRound: () => {
      const { round, lastQuestion } = get();
      if (round.active && lastQuestion) {
        get().markQuestionAsAnswered(
          lastQuestion.categoryName,
          lastQuestion.questionIndex
        );
      }

      const winner = round.positiveTeamId;
      set({
        lastQuestion: null,
        roundStep: null,
        round: initialRoundState(),
      });
```

(The rest of `endRound()` — the winner/`nextTurn()` branch and
`snapshotLiveState()` call — is unchanged.)

Find (5 remaining `isQuestionOpen: false,` spots — `setEditMode`, initial
state, `resetForNewUser`, `loadQuiz`, `completeSession`) and replace each
occurrence with `roundStep: null,`:

```ts
          ? { editMode: true, lastQuestion: null, isQuestionOpen: false }
```
→
```ts
          ? { editMode: true, lastQuestion: null, roundStep: null }
```

```ts
    isQuestionOpen: false,
    round: initialRoundState(),
```
(the initial store state, line ~598) →
```ts
    roundStep: null as RoundStep,
    round: initialRoundState(),
```

```ts
        lastQuestion: null,
        isQuestionOpen: false,
        round: initialRoundState(),
        adjustmentLog: [],
        currentTurnTeamId: null,
        isInitialTurnSelection: false,
        isPlayingPublicQuiz: false,
```
(inside `resetForNewUser()`) →
```ts
        lastQuestion: null,
        roundStep: null,
        round: initialRoundState(),
        adjustmentLog: [],
        currentTurnTeamId: null,
        isInitialTurnSelection: false,
        isPlayingPublicQuiz: false,
```

```ts
        lastQuestion: null,
        isQuestionOpen: false,
        round: initialRoundState(),
        isInitialTurnSelection: false,
        hasUnsavedChanges: false,
```
(inside `loadQuiz()`) →
```ts
        lastQuestion: null,
        roundStep: null,
        round: initialRoundState(),
        isInitialTurnSelection: false,
        hasUnsavedChanges: false,
```

```ts
          adjustmentLog: [],
          currentTurnTeamId: null,
          lastQuestion: null,
          isQuestionOpen: false,
        }));
```
(inside `completeSession()`) →
```ts
          adjustmentLog: [],
          currentTurnTeamId: null,
          lastQuestion: null,
          roundStep: null,
        }));
```

- [ ] **Step 5: Wire the new/renamed actions into the returned store object**

Find:

```ts
    manualAdjustScore: withUnsavedChanges(actions.manualAdjustScore, set),
    undoLastAdjustment: withUnsavedChanges(actions.undoLastAdjustment, set),
```

Replace with:

```ts
    manualAdjustScore: withUnsavedChanges(actions.manualAdjustScore, set),
    undoLastAdjustment: withUnsavedChanges(actions.undoLastAdjustment, set),
    undoLastAward: withUnsavedChanges(actions.undoLastAward, set),
```

Find:

```ts
    setLastQuestion: actions.setLastQuestion,
    setQuestionOpen: actions.setQuestionOpen,
    endRound: actions.endRound,
```

Replace with:

```ts
    setLastQuestion: actions.setLastQuestion,
    advanceRoundStep: actions.advanceRoundStep,
    cancelRound: actions.cancelRound,
    endRound: actions.endRound,
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- store-round-flow`
Expected: PASS, all 8 cases.

- [ ] **Step 7: Type-check and run the full suite**

```bash
npx tsc --noEmit
npm test
```

Expected: `tsc` will still fail here — `QuestionModal.tsx` and
`RoundDock.tsx` (not yet touched) reference `isQuestionOpen`/
`setQuestionOpen`, which no longer exist. That's expected; Tasks 2-6 remove
those files. `npm test` passes (vitest doesn't type-check).

- [ ] **Step 8: Commit**

```bash
git add utils/types.ts utils/store.ts utils/__tests__/store-round-flow.test.ts
git commit -m "feat: replace isQuestionOpen with a roundStep state machine, add undoLastAward"
```

---

### Task 2: `components/round/RoundScreen.tsx` — the four steps

**Files:**
- Create: `components/round/RoundScreen.tsx`

**Interfaces:**
- Consumes: `useGameStore` (`roundStep`, `advanceRoundStep`, `cancelRound`,
  `awardPositive`, `awardNegative`, `endRound`, `undoLastAward`,
  `lastQuestion`, `teams`, `round`, `adjustmentLog`, `activeRunId`,
  `startSession`, `quizTimeLimit`, `jokerTimeLimit`), `Timer` from
  `@/components/Timer`, `EmojiBurst` (dynamic import, `ssr: false`) from
  `@/components/EmojiBurst`, `Button` from `@/components/ui/button`.
- Produces: `RoundScreen()`, mounted by `GameStage.tsx` (Task 4) in place
  of the whole board layout whenever `roundStep` is not `null`.

No unit test — this is a React/DOM component tree with no test
infrastructure in this repo (see Del 1's Task 2 note). Verified in Task 7.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Lightbulb, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Timer } from "@/components/Timer";
import { useGameStore } from "@/utils/store";

const EmojiBurst = dynamic(() => import("../EmojiBurst"), { ssr: false });

const POS_EMOJIS = ["🔥", "💥", "💣", "🤟", "😎", "🍻", "🍾"];
const NEG_EMOJIS = ["🤣", "😂", "💀", "⚰️", "🤡"];

function isTypingTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return Boolean(
    target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
  );
}

/**
 * A round, on the whole page. The board's own state lives in the store, so
 * it is safe for GameStage to unmount it for as long as this is up.
 *
 * Remounted (via the key GameStage gives it) whenever lastQuestion changes
 * identity — that resets every step's local state (the joker countdown, the
 * award step's points stepper) by construction, the same way QuestionModal
 * and RoundDock used to key themselves per question.
 */
export function RoundScreen() {
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  if (!lastQuestion) return null;
  return (
    <RoundScreenBody
      key={`${lastQuestion.categoryName}-${lastQuestion.questionIndex}`}
    />
  );
}

function RoundScreenBody() {
  const roundStep = useGameStore((s) => s.roundStep);
  const activeRunId = useGameStore((s) => s.activeRunId);
  const startSession = useGameStore((s) => s.startSession);
  const [showBurst, setShowBurst] = useState(false);
  const [burstEmojis, setBurstEmojis] = useState<string[]>(POS_EMOJIS);

  // The first opened question starts the session that holds the live
  // state. startSession() is idempotent on both sides.
  useEffect(() => {
    if (activeRunId) return;
    void startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fireBurst = useCallback((emojis: string[]) => {
    setBurstEmojis(emojis);
    setShowBurst(true);
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <EmojiBurst
        show={showBurst}
        emojis={burstEmojis}
        duration={1500}
        intensity={1.1}
        onComplete={() => setShowBurst(false)}
      />

      <div
        key={roundStep ?? "none"}
        className="round-step-fade flex min-h-0 flex-1 flex-col"
      >
        {roundStep === "question" && <QuestionStep />}
        {roundStep === "answer" && <AnswerStep />}
        {roundStep === "award" && <AwardStep onFireBurst={fireBurst} />}
        {roundStep === "awarded" && <AwardedStep />}
      </div>
    </div>
  );
}

/** Left-column recap shown beside the award and awarded steps. */
function QuestionAnswerRecap() {
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  if (!lastQuestion) return null;
  const hasCode = Boolean(lastQuestion.code?.trim());

  return (
    <aside className="w-[480px] shrink-0 overflow-y-auto border-r border-border p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {lastQuestion.categoryName} • {lastQuestion.points}
      </p>
      {lastQuestion.question.trim() && (
        <p className="mt-3 text-2xl font-semibold leading-snug">
          {lastQuestion.question}
        </p>
      )}
      {hasCode && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-border bg-background/80 px-3 py-2 text-left font-mono text-sm leading-relaxed">
          <code>{lastQuestion.code}</code>
        </pre>
      )}
      <p
        className={
          hasCode
            ? "mt-4 whitespace-pre-wrap break-words font-mono text-[2.875rem] font-bold text-accent"
            : "mt-4 text-[2.875rem] font-extrabold leading-tight text-accent"
        }
      >
        {lastQuestion.answer || "(Ingen svartekst)"}
      </p>
      {lastQuestion.explanation?.trim() && (
        <p className="mt-3 whitespace-pre-wrap text-[17px] leading-snug text-muted-foreground">
          {lastQuestion.explanation}
        </p>
      )}
    </aside>
  );
}

/** Read-only team+score strip for the bottom of the question step. */
function ThinStandingsLine() {
  const teams = useGameStore((s) => s.teams);
  const currentTurnTeamId = useGameStore((s) => s.currentTurnTeamId);
  if (!teams.length) return null;

  return (
    <div className="flex items-center justify-center gap-2 overflow-x-auto border-t border-border/60 px-3 py-1.5 sm:px-6">
      {teams.map((team) => (
        <span
          key={team.id}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs sm:text-sm ${
            team.id === currentTurnTeamId ? "border-accent" : "border-border"
          }`}
        >
          <span className="max-w-[8rem] truncate font-medium">
            {team.name}
          </span>
          <span className="font-bold tabular-nums text-accent">
            {team.score}
          </span>
        </span>
      ))}
    </div>
  );
}

function QuestionStep() {
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  const quizTimeLimit = useGameStore((s) => s.quizTimeLimit);
  const jokerTimeLimit = useGameStore((s) => s.jokerTimeLimit);
  const advanceRoundStep = useGameStore((s) => s.advanceRoundStep);
  const cancelRound = useGameStore((s) => s.cancelRound);

  const isJoker = Boolean(lastQuestion?.isJoker);
  const hasCode = Boolean(lastQuestion?.code?.trim());
  // Seeded at mount, not in an effect: this component remounts fresh on
  // every new question (see RoundScreen's key).
  const [countdown, setCountdown] = useState<number | null>(() =>
    isJoker ? lastQuestion?.jokerTimer || jokerTimeLimit || 10 : null
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jokerRunning = isJoker && countdown !== null && countdown > 0;
  const jokerFinished = isJoker && countdown === 0;
  const isTimerActive = Boolean(quizTimeLimit && !isJoker);

  useEffect(() => {
    if (!isJoker) return;
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isJoker]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (useGameStore.getState().roundStep !== "question") return;
      if (isTypingTarget(event)) return;

      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        advanceRoundStep();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelRound();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advanceRoundStep, cancelRound]);

  if (!lastQuestion) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-8">
        <p className="text-left text-[clamp(1rem,2.8vh,1.8rem)] font-extrabold tracking-tight text-accent">
          {lastQuestion.categoryName} • {lastQuestion.points}
        </p>
        {isTimerActive && quizTimeLimit && (
          <Timer initialTime={quizTimeLimit} className="shrink-0" />
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto p-4 text-center sm:p-8">
        {jokerRunning ? (
          <div className="flex w-full max-w-5xl flex-col items-center gap-6">
            <div className="rounded-full bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 px-4 py-2 text-base font-black tracking-wider text-white shadow-lg">
              JOKER
            </div>
            <p className="px-2 text-[clamp(1.6rem,6.2vh,4.5rem)] font-bold leading-tight">
              {lastQuestion.jokerTask}
            </p>
            <div className="bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 bg-clip-text text-7xl font-black tabular-nums text-transparent drop-shadow-lg sm:text-9xl">
              {countdown}
            </div>
          </div>
        ) : (
          <>
            {jokerFinished && (
              <div className="flex w-full max-w-5xl flex-col items-center gap-4">
                <p className="bg-gradient-to-r from-red-500 via-orange-500 to-red-600 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
                  TIDEN ER UTE!
                </p>
                <p className="px-2 text-[clamp(1.1rem,3.4vh,2.2rem)] font-semibold leading-tight text-muted-foreground">
                  {lastQuestion.jokerTask}
                </p>
              </div>
            )}

            {!isJoker && (lastQuestion.question.trim() || !hasCode) && (
              <p className="px-2 text-[clamp(1.6rem,6vh,4.6rem)] font-semibold leading-tight">
                {lastQuestion.question || "(Ingen spørsmålstekst)"}
              </p>
            )}

            {hasCode && !isJoker && (
              <pre className="max-h-[52vh] w-full max-w-6xl overflow-auto rounded-lg border border-border bg-background/80 px-4 py-3 text-left font-mono text-[clamp(0.95rem,3.1vh,2.1rem)] leading-relaxed">
                <code>{lastQuestion.code}</code>
              </pre>
            )}

            {lastQuestion.imageUrl && !isJoker && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lastQuestion.imageUrl}
                alt="Illustrasjon til spørsmålet"
                className="max-h-[56vh] max-w-full rounded-lg object-contain shadow-lg"
                loading="eager"
              />
            )}
          </>
        )}
      </div>

      <ThinStandingsLine />

      <div className="border-t border-border p-3 sm:p-4">
        <Button
          onClick={advanceRoundStep}
          className="w-full bg-success py-6 text-lg text-success-foreground hover:bg-success/90"
        >
          {isJoker ? "Til poengtildeling" : "Vis svar"}
        </Button>
      </div>
    </div>
  );
}

function AnswerStep() {
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  const advanceRoundStep = useGameStore((s) => s.advanceRoundStep);
  const [explained, setExplained] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (useGameStore.getState().roundStep !== "answer") return;
      if (isTypingTarget(event)) return;

      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        advanceRoundStep();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advanceRoundStep]);

  if (!lastQuestion) return null;
  const hasCode = Boolean(lastQuestion.code?.trim());

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto p-4 text-center sm:p-8">
      <p className="text-[clamp(1rem,2.6vh,1.6rem)] font-semibold text-muted-foreground">
        {lastQuestion.categoryName} • {lastQuestion.points}
      </p>
      {lastQuestion.question.trim() && (
        <p className="px-2 text-[clamp(1rem,2.8vh,1.8rem)] font-medium text-muted-foreground">
          {lastQuestion.question}
        </p>
      )}
      {hasCode && (
        <pre className="max-h-[30vh] w-full max-w-6xl overflow-auto rounded-lg border border-border bg-background/80 px-4 py-3 text-left font-mono text-[clamp(0.9rem,2.6vh,1.5rem)] leading-relaxed">
          <code>{lastQuestion.code}</code>
        </pre>
      )}
      <div className="w-full max-w-5xl rounded-lg border border-border bg-muted p-4">
        <p
          className={
            hasCode
              ? "whitespace-pre-wrap break-words font-mono text-[clamp(1.4rem,6vh,4rem)] font-bold text-accent"
              : "text-[clamp(1.8rem,7.5vh,5.5rem)] font-extrabold tracking-tight text-accent"
          }
        >
          {lastQuestion.answer || "(Ingen svartekst)"}
        </p>
      </div>
      {lastQuestion.explanation?.trim() &&
        (explained ? (
          <p className="whitespace-pre-wrap px-2 text-[clamp(0.9rem,2.2vh,1.2rem)] leading-snug text-muted-foreground">
            {lastQuestion.explanation}
          </p>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExplained(true)}
            className="gap-2 text-muted-foreground"
          >
            <Lightbulb className="h-4 w-4" />
            Forklar
          </Button>
        ))}

      <Button
        onClick={advanceRoundStep}
        className="mt-auto w-full max-w-md bg-accent py-6 text-lg text-accent-foreground hover:bg-accent/90"
      >
        Tildel poeng
      </Button>
    </div>
  );
}

function AwardStep({
  onFireBurst,
}: {
  onFireBurst: (emojis: string[]) => void;
}) {
  const lastQuestion = useGameStore((s) => s.lastQuestion);
  const teams = useGameStore((s) => s.teams);
  const round = useGameStore((s) => s.round);
  const awardPositive = useGameStore((s) => s.awardPositive);
  const awardNegative = useGameStore((s) => s.awardNegative);

  const [points, setPoints] = useState(() => lastQuestion?.points ?? 0);
  const [penaltyArmed, setPenaltyArmed] = useState(false);
  const penaltyAmount = lastQuestion
    ? Math.round(lastQuestion.points * 0.5)
    : 0;

  const handleCorrect = useCallback(
    (teamId: string) => {
      if (round.positiveTeamId) return;
      onFireBurst(POS_EMOJIS);
      // Let the canvas mount before the state change that re-renders this step.
      setTimeout(() => awardPositive(teamId, points), 0);
    },
    [round.positiveTeamId, onFireBurst, awardPositive, points]
  );

  const handlePenalty = useCallback(
    (teamId: string) => {
      if (round.positiveTeamId || round.negativeAwardedTo.includes(teamId))
        return;
      onFireBurst(NEG_EMOJIS);
      awardNegative(teamId);
    },
    [round.positiveTeamId, round.negativeAwardedTo, onFireBurst, awardNegative]
  );

  const handleTeamClick = (teamId: string) => {
    if (penaltyArmed) {
      handlePenalty(teamId);
      setPenaltyArmed(false);
    } else {
      handleCorrect(teamId);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (useGameStore.getState().roundStep !== "award") return;
      if (isTypingTarget(event)) return;

      if (event.key >= "1" && event.key <= "9") {
        const index = Number(event.key) - 1;
        const team = teams[index];
        if (!team) return;
        event.preventDefault();
        if (event.shiftKey) {
          handlePenalty(team.id);
        } else {
          handleCorrect(team.id);
        }
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        useGameStore.getState().endRound();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [teams, handleCorrect, handlePenalty]);

  if (!lastQuestion) return null;

  return (
    <div className="flex min-h-0 flex-1">
      <QuestionAnswerRecap />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <p className="text-[clamp(1.3rem,3.6vh,2.2rem)] font-bold">
          Hvem svarte riktig?
        </p>

        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-muted-foreground">
            Poeng
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setPoints((p) => Math.max(0, p - 50))}
            aria-label="Trekk fra 50 poeng"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-16 text-center text-xl font-bold tabular-nums">
            {points}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setPoints((p) => p + 50)}
            aria-label="Legg til 50 poeng"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {teams.length === 0 ? (
          <p className="text-muted-foreground">Legg til lagene først</p>
        ) : (
          <div className="grid w-full max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3">
            {teams.map((team, index) => {
              const disabled =
                Boolean(round.positiveTeamId) ||
                (penaltyArmed && round.negativeAwardedTo.includes(team.id));
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => handleTeamClick(team.id)}
                  disabled={disabled}
                  className={[
                    "tile flex flex-col items-center gap-1 px-4 py-5 text-center transition-colors",
                    disabled ? "cursor-not-allowed opacity-40" : "",
                    penaltyArmed
                      ? "border-2 border-destructive bg-destructive/10"
                      : "hover:border-accent/70",
                  ].join(" ")}
                >
                  {index < 9 && (
                    <kbd className="rounded bg-muted px-1.5 text-xs text-muted-foreground">
                      {index + 1}
                    </kbd>
                  )}
                  <span className="max-w-full truncate text-lg font-bold">
                    {team.name}
                  </span>
                  <span className="text-2xl font-extrabold tabular-nums text-accent">
                    {team.score}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => setPenaltyArmed((armed) => !armed)}
          className={[
            "mt-4 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
            penaltyArmed
              ? "border-destructive bg-destructive text-destructive-foreground"
              : "border-border text-muted-foreground hover:border-destructive/60 hover:text-destructive",
          ].join(" ")}
        >
          Trekk {penaltyAmount} fra et lag
        </button>
      </div>
    </div>
  );
}

function AwardedStep() {
  const round = useGameStore((s) => s.round);
  const teams = useGameStore((s) => s.teams);
  const adjustmentLog = useGameStore((s) => s.adjustmentLog);
  const endRound = useGameStore((s) => s.endRound);
  const undoLastAward = useGameStore((s) => s.undoLastAward);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (useGameStore.getState().roundStep !== "awarded") return;
      if (isTypingTarget(event)) return;

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        endRound();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [endRound]);

  const winner = teams.find((t) => t.id === round.positiveTeamId) ?? null;
  const lastEntry = adjustmentLog[0];
  if (!winner || !lastEntry) return null;
  const before = winner.score - lastEntry.delta;

  return (
    <div className="flex min-h-0 flex-1">
      <QuestionAnswerRecap />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-primary/5 p-6 text-center">
        <p className="text-[clamp(1.6rem,5vh,3.2rem)] font-extrabold text-primary">
          {lastEntry.delta} poeng til {winner.name}
        </p>
        <p className="text-[clamp(1.4rem,4.4vh,2.6rem)] font-bold tabular-nums text-muted-foreground">
          {before} <span aria-hidden>→</span> {winner.score}
        </p>
        <p className="text-lg text-muted-foreground">
          {winner.name} velger neste kort
        </p>

        <div className="mt-4 flex gap-3">
          <Button variant="ghost" onClick={undoLastAward}>
            Angre
          </Button>
          <Button
            size="lg"
            onClick={endRound}
            className="bg-primary px-10 py-6 text-lg text-primary-foreground hover:bg-primary/90"
          >
            Neste spørsmål
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/round/RoundScreen.tsx
git commit -m "feat: add the four-step RoundScreen replacing QuestionModal/RoundDock"
```

---

### Task 3: `app/globals.css` — the cross-fade

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add the fade, near the other `@layer components` rules**

```css
  @keyframes round-step-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .round-step-fade {
    animation: round-step-fade-in 150ms ease-out;
  }
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "style: add the round step cross-fade"
```

---

### Task 4: `components/GameStage.tsx` — round takes over the page

**Files:**
- Modify: `components/GameStage.tsx` (full file)

**Interfaces:**
- Consumes: `RoundScreen` from `@/components/round/RoundScreen`.

- [ ] **Step 1: Replace the whole file**

```tsx
"use client";

import { GameBoard } from "@/components/GameBoard";
import { GameTopBar } from "@/components/GameTopBar";
import { RoundScreen } from "@/components/round/RoundScreen";
import { Standings } from "@/components/Standings";
import { usePresentationMode } from "@/hooks/usePresentationMode";
import { useBoardGeometry } from "@/hooks/useBoardGeometry";
import { boardGeometryCssVars } from "@/utils/board-geometry";
import { useGameStore } from "@/utils/store";
import type { CSSProperties } from "react";

/**
 * Playing a quiz, on one screen — until a round starts, when RoundScreen
 * takes the whole page instead. The board's state lives in the store, so
 * unmounting it here for the length of a round is safe: it's exactly the
 * same tree when the round ends.
 */
export function GameStage() {
  const presentation = usePresentationMode();
  const roundStep = useGameStore((s) => s.roundStep);
  const categoryCount = useGameStore((s) => s.categories.length);
  const maxRows = useGameStore((s) =>
    s.categories.reduce((most, c) => Math.max(most, c.questions.length), 0)
  );

  const geometry = useBoardGeometry(categoryCount, maxRows);
  const geometryVars = boardGeometryCssVars(geometry) as CSSProperties;

  if (roundStep) {
    return <RoundScreen />;
  }

  return (
    <main className="stage flex h-dvh flex-col overflow-hidden">
      <GameTopBar presentation={presentation} />

      <div
        className="flex min-h-0 flex-1 justify-center gap-5 px-3 py-2 sm:px-6 sm:py-3"
        style={geometryVars}
      >
        <section className="min-h-0 min-w-0 overflow-y-auto">
          <GameBoard />
        </section>

        {geometry.panelBeside && (
          <div className="flex-[0_0_var(--panel-w)]">
            <Standings layout="column" />
          </div>
        )}
      </div>

      {/* Always 128px, holding the standings row or nothing — a round no
          longer lives down here, so the only remaining job of this row is
          the narrow-layout standings. It stays constant height either way,
          per Del 1. */}
      <div className="h-32 shrink-0 overflow-y-auto border-t border-border/60 bg-background/40 px-3 py-2 backdrop-blur sm:px-6">
        {!geometry.panelBeside && <Standings layout="row" />}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/GameStage.tsx
git commit -m "refactor: GameStage renders RoundScreen full-page during a round"
```

---

### Task 5: `components/GameBoard.tsx` — drop the deleted `QuestionModal` mount

**Files:**
- Modify: `components/GameBoard.tsx`

Not in the spec's file list, but required: `GameBoard.tsx` imports and
renders `<QuestionModal />` directly (verified by reading the file). Task 6
deletes `QuestionModal.tsx`; without this fix the build breaks on a missing
import.

- [ ] **Step 1: Remove the import and the mount**

Find:

```tsx
import { Fragment, useCallback, useState } from "react";
import { useGameStore } from "@/utils/store";
import { QuestionModal } from "./QuestionModal";
import { Image as ImageIcon, RotateCcw, Sparkles } from "lucide-react";
```

Replace with:

```tsx
import { Fragment, useCallback, useState } from "react";
import { useGameStore } from "@/utils/store";
import { Image as ImageIcon, RotateCcw, Sparkles } from "lucide-react";
```

Find:

```tsx
      </AlertDialog>

      <QuestionModal />
    </>
  );
}
```

Replace with:

```tsx
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/GameBoard.tsx
git commit -m "refactor: GameBoard no longer mounts the deleted QuestionModal"
```

---

### Task 6: Delete `QuestionModal.tsx` and `RoundDock.tsx`

**Files:**
- Delete: `components/QuestionModal.tsx`
- Delete: `components/RoundDock.tsx`

Both are fully superseded by `components/round/RoundScreen.tsx` (Task 2),
and Tasks 4-5 removed their only remaining call sites.

- [ ] **Step 1: Delete and commit**

```bash
git rm components/QuestionModal.tsx components/RoundDock.tsx
git commit -m "refactor: remove QuestionModal and RoundDock, replaced by RoundScreen"
```

---

### Task 7: Verify in the running app

No component-test infrastructure exists (see Del 1's Task 2 note) — this is
a browser verification task.

**Files:** none — verification only.

- [ ] **Step 1: Start the dev server, open a quiz with teams and a mixed board**

Include at least one normal question with an explanation, one with a code
snippet, and one joker card.

- [ ] **Step 2: Walk the golden path**

Click a tile → `question` step shows (green CTA, thin standings line at the
bottom, Timer if the quiz has a time limit). Press `Space` → `answer` step
(gold CTA, "Forklar" reveals the explanation on click). Press `Space` again
→ `award` step (no CTA; team cards + points stepper + the "Trekk N fra et
lag" box below them). Click a team → burst fires, `awarded` step shows
"N poeng til Lag X", `before → after`, and the winner's name. Click "Neste
spørsmål" → back to the board, board height unchanged, the winning team
has the turn.

- [ ] **Step 3: Verify the fallgruve-sensitive paths**

- From `question`, press `Escape`: round cancels, the card is still
  playable on the board (not marked answered).
- Open a joker card: `question` → `Space` skips straight to `award` (no
  `answer` step).
- In `award`, click the "Trekk N fra et lag" box, then a team: that team's
  score drops by the penalty, `roundStep` stays on `award` (no CTA color
  change), and a second click on another team (without re-arming) awards
  it as correct instead.
- Reach `awarded`, click "Angre": the awarded team's score reverts, the
  screen returns to `award`, and that team's card is clickable again as a
  correct answer.
- Press `1`-`9` in `award` to award by keyboard; press `Shift`+`1`-`9` to
  penalize by keyboard. Press `N` from both `award` and `awarded` to end
  the round early.
- Confirm `EmojiBurst`'s canvas is still visible/animating across the
  `award` → `awarded` transition (it must not remount and cut the
  animation short).

- [ ] **Step 4: Run the full test suite, type-check, and build**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all tests pass (including the new `store-round-flow` suite), no
type errors, build succeeds.

- [ ] **Step 5: Commit if Steps 1-3 required any fixes**

```bash
git add -A
git commit -m "fix: round-flow verification fixes"
```

(Skip this commit if no fixes were needed.)

---

## Self-Review Notes

- **Spec coverage:** the four steps and their CTAs/colors (Task 2), the
  state rename and `undoLastAward` (Task 1), the keyboard table (Task 2,
  one effect per step, `event.repeat` guard, live `roundStep` re-check),
  the points stepper and the "boxed, one-shot" penalty control (Task 2's
  `AwardStep`), the 480px recap sidebar with 24/46/17px type (Task 2's
  `QuestionAnswerRecap`), the 150ms cross-fade (Task 3), what's kept
  (Timer, joker countdown, code `<pre>`, EmojiBurst at the root, Confetti
  untouched), and the file list (GameStage, store, types, new
  RoundScreen.tsx, QuestionModal/RoundDock deleted) are all covered. Two
  files not in the spec's list were added because they're required for the
  build to succeed: `GameBoard.tsx` (Task 5) and `globals.css` (Task 3) —
  both called out in the Assumptions section.
- **Placeholder scan:** no TBD/"add error handling"/paraphrased steps;
  every code block is the literal file content or a literal find/replace.
- **Type consistency:** `RoundStep` is defined once in `types.ts` and used
  identically in `store.ts`, the test file, and `RoundScreen.tsx` (via
  `useGameStore.getState().roundStep`, never re-declared). `AdjustmentEntry`
  gains `"award"`/`"penalty"` in the same place it's consumed
  (`store.ts`'s `awardPositive`/`awardNegative`) — checked, no drift.
