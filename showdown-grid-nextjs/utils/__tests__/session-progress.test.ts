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
