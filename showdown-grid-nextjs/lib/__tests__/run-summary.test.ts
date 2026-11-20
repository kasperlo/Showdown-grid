import { describe, expect, it } from "vitest";
import {
  buildCategorySummary,
  playedWindow,
  rankRunTeams,
  readAnsweredKeys,
  winnerLabel,
} from "../run-summary";

const quizData = {
  categories: [
    { id: "x", name: "Musikk", questions: [{}, {}] },
    { id: "y", name: "Musikk", questions: [{}, {}] },
    { name: "Gammel", questions: [{}] },
  ],
};

describe("buildCategorySummary", () => {
  it("counts answered cards by category id, keeping equal names apart", () => {
    const summary = buildCategorySummary(quizData, ["id:x|0", "id:x|1", "id:c2|0"]);
    expect(summary.map((c) => c.answered)).toEqual([2, 0, 1]);
  });

  it("still counts keys written by name in older runs", () => {
    const summary = buildCategorySummary(quizData, ["Gammel|0"]);
    expect(summary[2].answered).toBe(1);
  });

  it("is empty when the quiz could not be read", () => {
    expect(buildCategorySummary(null, ["id:x|0"])).toEqual([]);
  });
});

describe("readAnsweredKeys", () => {
  it("reads the legacy whole-board shape", () => {
    expect(
      readAnsweredKeys({
        categories: [{ name: "Mat", questions: [{ answered: true }, { answered: false }] }],
      })
    ).toEqual(["Mat|0"]);
  });
});

describe("ranking and the winner", () => {
  it("keeps the players and names every team sharing first place", () => {
    const ranked = rankRunTeams([
      { id: "a", name: "Alfa", score: 300, players: ["Kari"] },
      { id: "b", name: "Bravo", score: 300 },
      { id: "c", name: "Charlie", score: 100 },
    ]);

    expect(ranked.map((t) => t.rank)).toEqual([1, 1, 3]);
    expect(ranked[0].players).toEqual(["Kari"]);
    expect(winnerLabel(ranked)).toBe("Alfa og Bravo");
  });

  it("names a single winner on its own", () => {
    expect(winnerLabel(rankRunTeams([{ id: "a", name: "Alfa", score: 1 }]))).toBe("Alfa");
    expect(winnerLabel([])).toBeNull();
  });
});

describe("playedWindow", () => {
  const start = "2026-11-20T18:00:00.000Z";
  const nextDay = new Date("2026-11-21T09:00:00.000Z");

  it("ends at the last action, not when the run was archived", () => {
    const last = new Date("2026-11-20T20:15:00.000Z").getTime();
    const { endedAt, durationSeconds } = playedWindow(start, last, nextDay);
    expect(endedAt.toISOString()).toBe("2026-11-20T20:15:00.000Z");
    expect(durationSeconds).toBe(2 * 3600 + 15 * 60);
  });

  it("falls back to now without a usable last action", () => {
    expect(playedWindow(start, undefined, nextDay).endedAt).toEqual(nextDay);
    expect(playedWindow(start, 0, nextDay).endedAt).toEqual(nextDay);
  });
});
