import { describe, expect, it } from "vitest";
import { snapshotIsAhead, SNAPSHOT_MAX_AGE_MS } from "../live-snapshot";
import type { LiveGameState } from "../types";

function live(
  answered: string[],
  scores: Record<string, number> = {}
): LiveGameState {
  return {
    answeredKeys: answered,
    scores,
    adjustmentLog: [],
    currentTurnTeamId: null,
    version: 2,
  };
}

const fresh = (state: LiveGameState) => ({
  live: state,
  savedAt: Date.now(),
  runId: "run-1",
});

describe("snapshotIsAhead", () => {
  it("prefers the local copy when it holds more answered questions", () => {
    expect(
      snapshotIsAhead(fresh(live(["A|0", "A|1"])), live(["A|0"]))
    ).toBe(true);
  });

  it("prefers the server when it is equal", () => {
    expect(snapshotIsAhead(fresh(live(["A|0"])), live(["A|0"]))).toBe(false);
  });

  it("prefers the server when the local copy is behind", () => {
    expect(
      snapshotIsAhead(fresh(live(["A|0"])), live(["A|0", "A|1"]))
    ).toBe(false);
  });

  it("uses the local copy when the server has no session at all", () => {
    expect(snapshotIsAhead(fresh(live([])), null)).toBe(true);
  });

  it("catches a score change that never reached the server", () => {
    expect(
      snapshotIsAhead(fresh(live(["A|0"], { a: 300 })), live(["A|0"], { a: 100 }))
    ).toBe(true);
  });

  it("ignores a snapshot from a previous evening", () => {
    const stale = {
      live: live(["A|0", "A|1", "A|2"]),
      savedAt: Date.now() - SNAPSHOT_MAX_AGE_MS - 1000,
      runId: "run-old",
    };
    expect(snapshotIsAhead(stale, live([]))).toBe(false);
  });

  it("is false when there is no snapshot", () => {
    expect(snapshotIsAhead(null, live([]))).toBe(false);
  });
});
