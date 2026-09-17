import { describe, expect, it } from "vitest";
import { rankTeams } from "../ranking";

describe("rankTeams", () => {
  it("gives tied teams the same place and skips the next one", () => {
    const ranked = rankTeams([
      { id: "a", name: "Alfa", score: 300, players: [] },
      { id: "b", name: "Bravo", score: 500, players: [] },
      { id: "c", name: "Charlie", score: 500, players: [] },
      { id: "d", name: "Delta", score: 100, players: [] },
    ]);

    expect(ranked.map((t) => [t.name, t.rank])).toEqual([
      ["Bravo", 1],
      ["Charlie", 1],
      ["Alfa", 3],
      ["Delta", 4],
    ]);
  });

  it("orders a tie by name so the podium does not jump between renders", () => {
    const ranked = rankTeams([
      { id: "b", name: "Østfold", score: 100, players: [] },
      { id: "a", name: "Agder", score: 100, players: [] },
    ]);

    expect(ranked.map((t) => t.name)).toEqual(["Agder", "Østfold"]);
  });

  it("handles negative scores and an empty list", () => {
    expect(rankTeams([])).toEqual([]);
    const ranked = rankTeams([
      { id: "a", name: "Alfa", score: -50, players: [] },
      { id: "b", name: "Bravo", score: 0, players: [] },
    ]);
    expect(ranked.map((t) => t.rank)).toEqual([1, 2]);
    expect(ranked[0].name).toBe("Bravo");
  });
});
