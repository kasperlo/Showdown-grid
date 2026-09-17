import { describe, expect, it } from "vitest";
import {
  buildQueue,
  cardStatus,
  ladderFor,
  normalizePoints,
  readiness,
} from "../card-status";
import type { Category, Question } from "../types";

function q(overrides: Partial<Question>): Question {
  return {
    points: 100,
    question: "",
    answer: "",
    imageUrl: "",
    isJoker: false,
    jokerTask: "",
    jokerTimer: 10,
    answered: false,
    ...overrides,
  };
}

function board(): Category[] {
  return [
    {
      name: "Film",
      questions: [
        q({ points: 100, question: "Q", answer: "A" }),
        q({ points: 200, question: "Q" }),
        q({ points: 300 }),
      ],
    },
    {
      name: "Mat",
      questions: [
        q({ points: 100, isJoker: true, jokerTask: "Syng" }),
        q({ points: 200, isJoker: true }),
        q({ points: 300, answer: "A" }),
      ],
    },
  ];
}

describe("cardStatus", () => {
  it("separates empty from half-filled", () => {
    expect(cardStatus(q({ question: "Q", answer: "A" }))).toBe("complete");
    expect(cardStatus(q({ question: "Q" }))).toBe("missing-answer");
    expect(cardStatus(q({ answer: "A" }))).toBe("missing-question");
    expect(cardStatus(q({}))).toBe("empty");
  });

  it("counts a joker as complete on its task alone", () => {
    expect(cardStatus(q({ isJoker: true, jokerTask: "Syng" }))).toBe("complete");
    expect(cardStatus(q({ isJoker: true }))).toBe("empty");
  });

  it("ignores question and answer once a card is a joker", () => {
    expect(
      cardStatus(q({ isJoker: true, jokerTask: "Syng", question: "", answer: "" }))
    ).toBe("complete");
  });

  it("treats whitespace as empty", () => {
    expect(cardStatus(q({ question: "   ", answer: "\n" }))).toBe("empty");
  });
});

describe("buildQueue", () => {
  it("walks column by column, top to bottom", () => {
    const all = buildQueue(board(), "all");
    expect(all.map((c) => `${c.categoryIndex}:${c.questionIndex}`)).toEqual([
      "0:0",
      "0:1",
      "0:2",
      "1:0",
      "1:1",
      "1:2",
    ]);
  });

  it("picks out only what is unfinished", () => {
    const incomplete = buildQueue(board(), "incomplete");
    expect(incomplete.map((c) => `${c.categoryIndex}:${c.questionIndex}`)).toEqual(
      ["0:1", "0:2", "1:1", "1:2"]
    );
  });

  it("filters to jokers and to one column", () => {
    expect(buildQueue(board(), "jokers")).toHaveLength(2);
    expect(buildQueue(board(), "category", 1)).toHaveLength(3);
    expect(buildQueue(board(), "category", 99)).toHaveLength(0);
  });
});

describe("readiness", () => {
  it("counts finished, missing, images and jokers", () => {
    const withImage = board();
    withImage[0].questions[0].imageUrl = "https://example.com/a.png";

    const result = readiness(withImage);
    expect(result.total).toBe(6);
    expect(result.complete).toBe(2);
    expect(result.missing).toBe(4);
    expect(result.withImage).toBe(1);
    expect(result.jokers).toBe(2);
    expect(result.percent).toBe(33);
  });

  it("is 0 % rather than NaN on an empty board", () => {
    expect(readiness([]).percent).toBe(0);
  });
});

describe("ladderFor", () => {
  it("keeps a custom ladder and extends it by its own step", () => {
    expect(ladderFor([200, 400, 600], 5)).toEqual([200, 400, 600, 800, 1000]);
  });

  it("truncates when the column shrinks", () => {
    expect(ladderFor([100, 200, 300, 400, 500], 3)).toEqual([100, 200, 300]);
  });

  it("falls back to hundreds when there is nothing to go on", () => {
    expect(ladderFor([], 3)).toEqual([100, 200, 300]);
    expect(ladderFor([0, -50], 2)).toEqual([100, 200]);
  });

  it("extends a single known value by itself", () => {
    expect(ladderFor([250], 3)).toEqual([250, 500, 750]);
  });
});

describe("normalizePoints", () => {
  it("gives a moved card the points of the place it landed", () => {
    // Film: the 300 card has been dragged to the top of the column.
    const moved: Category[] = [
      {
        name: "Film",
        questions: [
          q({ points: 300, question: "C" }),
          q({ points: 100, question: "A" }),
          q({ points: 200, question: "B" }),
        ],
      },
    ];

    const result = normalizePoints(moved);
    expect(result[0].questions.map((x) => [x.question, x.points])).toEqual([
      ["C", 100],
      ["A", 200],
      ["B", 300],
    ]);
  });

  it("renumbers each column on its own", () => {
    const mixed: Category[] = [
      { name: "A", questions: [q({ points: 500 }), q({ points: 100 })] },
      { name: "B", questions: [q({ points: 200 }), q({ points: 400 })] },
    ];

    const result = normalizePoints(mixed);
    expect(result[0].questions.map((x) => x.points)).toEqual([100, 500]);
    expect(result[1].questions.map((x) => x.points)).toEqual([200, 400]);
  });

  it("leaves an already-ordered column untouched", () => {
    const ordered = board();
    const result = normalizePoints(ordered);
    expect(result[0].questions[0]).toBe(ordered[0].questions[0]);
  });
});
