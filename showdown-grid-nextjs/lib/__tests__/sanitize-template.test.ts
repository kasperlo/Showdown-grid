import { describe, expect, it } from "vitest";
import { sanitizeQuizData } from "../sanitize-template";

describe("sanitizeQuizData", () => {
  it("refuses to store played state even if the client sends it", () => {
    const result = sanitizeQuizData({
      categories: [
        {
          name: "Historie",
          questions: [
            { points: 100, question: "Q", answer: "A", answered: true },
          ],
        },
      ],
      teams: [{ id: "a", name: "Alfa", score: 900, players: ["Kari"] }],
    });

    expect(result.categories[0].questions[0].answered).toBe(false);
    expect(result.teams[0].score).toBe(0);
    expect(result.teams[0].players).toEqual(["Kari"]);
  });

  it("survives junk without throwing", () => {
    const result = sanitizeQuizData({
      categories: [null, 42, { questions: "nope" }],
      teams: [{ name: "Uten id" }, "string"],
      jokerTimeLimit: "ti",
    });

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe("Uten navn");
    expect(result.categories[0].questions).toEqual([]);
    expect(result.teams).toEqual([]);
    expect(result.jokerTimeLimit).toBeNull();
  });

  it("keeps the code snippet and the explanation, capped", () => {
    const result = sanitizeQuizData({
      categories: [
        {
          name: "Kode",
          questions: [
            {
              points: 500,
              question: "Hva printes?",
              answer: "true false",
              code: "c".repeat(5000),
              explanation: "e".repeat(3000),
            },
          ],
        },
      ],
    });

    const card = result.categories[0].questions[0];
    expect(card.code).toHaveLength(4000);
    expect(card.explanation).toHaveLength(2000);
  });

  it("returns an empty string rather than dropping the explanation", () => {
    const result = sanitizeQuizData({
      categories: [{ name: "Mat", questions: [{ points: 100 }] }],
    });

    // An absent key reads as undefined in an older client; an empty string does
    // not. This is why the field went missing from the database once already.
    expect(result.categories[0].questions[0].explanation).toBe("");
  });

  it("returns an empty board for a missing payload", () => {
    expect(sanitizeQuizData(undefined)).toEqual({
      categories: [],
      teams: [],
      jokerTimeLimit: null,
    });
  });

  it("caps runaway strings and player lists", () => {
    const result = sanitizeQuizData({
      categories: [
        {
          name: "x".repeat(500),
          questions: [{ points: 100, question: "y".repeat(5000) }],
        },
      ],
      teams: [
        {
          id: "a",
          name: "Alfa",
          players: Array.from({ length: 50 }, (_, i) => `P${i}`),
        },
      ],
    });

    expect(result.categories[0].name).toHaveLength(120);
    expect(result.categories[0].questions[0].question).toHaveLength(2000);
    expect(result.teams[0].players).toHaveLength(20);
  });

  it("keeps a joker task and its timer", () => {
    const result = sanitizeQuizData({
      categories: [
        {
          name: "Joker",
          questions: [
            { points: 300, isJoker: true, jokerTask: "Syng", jokerTimer: 15 },
          ],
        },
      ],
      teams: [],
    });

    const question = result.categories[0].questions[0];
    expect(question.isJoker).toBe(true);
    expect(question.jokerTask).toBe("Syng");
    expect(question.jokerTimer).toBe(15);
  });
});
