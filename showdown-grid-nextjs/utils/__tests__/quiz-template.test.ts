import { describe, expect, it } from "vitest";
import {
  answeredKey,
  countCompleteQuestions,
  extractLiveState,
  extractTemplate,
  isQuestionComplete,
  liveStateFromRunState,
  mergeLiveIntoTemplate,
  templateFromQuizData,
} from "../quiz-template";
import type { Category, Team } from "../types";

function board(): Category[] {
  return [
    {
      name: "Historie",
      questions: [
        {
          points: 100,
          question: "Q1",
          answer: "A1",
          answered: true,
          imageUrl: "",
          isJoker: false,
          jokerTask: "",
          jokerTimer: 10,
        },
        {
          points: 200,
          question: "Q2",
          answer: "A2",
          answered: false,
          imageUrl: "",
          isJoker: false,
          jokerTask: "",
          jokerTimer: 10,
        },
      ],
    },
    {
      name: "Mat",
      questions: [
        {
          points: 100,
          question: "",
          answer: "",
          answered: true,
          imageUrl: "",
          isJoker: true,
          jokerTask: "Syng",
          jokerTimer: 15,
        },
      ],
    },
  ];
}

const teams: Team[] = [
  { id: "a", name: "Alfa", score: 400, players: ["Kari"] },
  { id: "b", name: "Bravo", score: -100, players: [] },
];

const meta = {
  quizTitle: "Testquiz",
  quizDescription: "beskrivelse",
  quizTimeLimit: 60,
  jokerTimeLimit: 12,
  quizTheme: "modern" as const,
  quizIsPublic: true,
};

describe("extractTemplate", () => {
  it("strips everything that belongs to one playthrough", () => {
    const template = extractTemplate({ categories: board(), teams, ...meta });

    expect(
      template.categories.flatMap((c) => c.questions.map((q) => q.answered))
    ).toEqual([false, false, false]);
    expect(template.teams.map((t) => t.score)).toEqual([0, 0]);
  });

  it("keeps the roster and the metadata", () => {
    const template = extractTemplate({ categories: board(), teams, ...meta });

    expect(template.teams.map((t) => t.name)).toEqual(["Alfa", "Bravo"]);
    expect(template.teams[0].players).toEqual(["Kari"]);
    expect(template.quizTitle).toBe("Testquiz");
    expect(template.jokerTimeLimit).toBe(12);
    expect(template.quizIsPublic).toBe(true);
  });

  it("does not alias the source arrays", () => {
    const categories = board();
    const template = extractTemplate({ categories, teams, ...meta });

    template.categories[0].questions[0].question = "endret";
    expect(categories[0].questions[0].question).toBe("Q1");
  });
});

describe("extractLiveState", () => {
  it("records answered questions by category and index", () => {
    const live = extractLiveState({
      categories: board(),
      teams,
      adjustmentLog: [],
      currentTurnTeamId: "b",
    });

    expect(live.answeredKeys).toEqual([
      answeredKey("Historie", 0),
      answeredKey("Mat", 0),
    ]);
    expect(live.scores).toEqual({ a: 400, b: -100 });
    expect(live.currentTurnTeamId).toBe("b");
  });
});

describe("mergeLiveIntoTemplate", () => {
  it("lays scores and answered questions back over a clean template", () => {
    const template = extractTemplate({ categories: board(), teams, ...meta });
    const live = extractLiveState({
      categories: board(),
      teams,
      adjustmentLog: [],
      currentTurnTeamId: "a",
    });

    const merged = mergeLiveIntoTemplate(template, live);

    expect(merged.categories[0].questions[0].answered).toBe(true);
    expect(merged.categories[0].questions[1].answered).toBe(false);
    expect(merged.teams.find((t) => t.id === "a")?.score).toBe(400);
    expect(merged.currentTurnTeamId).toBe("a");
  });

  it("starts from zero when there is no live state", () => {
    const template = extractTemplate({ categories: board(), teams, ...meta });
    const merged = mergeLiveIntoTemplate(template, null);

    expect(merged.teams.every((t) => t.score === 0)).toBe(true);
    expect(
      merged.categories.every((c) => c.questions.every((q) => !q.answered))
    ).toBe(true);
  });

  it("drops a turn pointing at a team that no longer exists", () => {
    const template = extractTemplate({ categories: board(), teams, ...meta });
    const merged = mergeLiveIntoTemplate(template, {
      answeredKeys: [],
      scores: { gone: 100 },
      adjustmentLog: [],
      currentTurnTeamId: "gone",
      version: 2,
    });

    expect(merged.currentTurnTeamId).toBeNull();
    expect(merged.teams.every((t) => t.score === 0)).toBe(true);
  });

  it("ignores answered keys for questions the board no longer has", () => {
    const template = extractTemplate({ categories: board(), teams, ...meta });
    const merged = mergeLiveIntoTemplate(template, {
      answeredKeys: ["Slettet kategori|3", "Historie|99"],
      scores: {},
      adjustmentLog: [],
      currentTurnTeamId: null,
      version: 2,
    });

    expect(
      merged.categories.every((c) => c.questions.every((q) => !q.answered))
    ).toBe(true);
  });
});

describe("liveStateFromRunState", () => {
  it("reads the compact shape", () => {
    const live = liveStateFromRunState({
      answeredKeys: ["Historie|0"],
      scores: { a: 100 },
      adjustmentLog: [],
      currentTurnTeamId: null,
    });

    expect(live?.answeredKeys).toEqual(["Historie|0"]);
    expect(live?.version).toBe(2);
  });

  it("converts a legacy run that stored the whole board", () => {
    const live = liveStateFromRunState({
      categories: board(),
      teams,
      adjustmentLog: [],
    });

    expect(live?.version).toBe(1);
    expect(live?.answeredKeys).toEqual(["Historie|0", "Mat|0"]);
    expect(live?.scores).toEqual({ a: 400, b: -100 });
  });

  it("returns null for an empty or unknown shape", () => {
    expect(liveStateFromRunState(null)).toBeNull();
    expect(liveStateFromRunState({})).toBeNull();
  });
});

describe("templateFromQuizData", () => {
  it("throws away played state stored by older versions of the app", () => {
    const template = templateFromQuizData(
      { categories: board(), teams, jokerTimeLimit: 20 },
      {
        quizTitle: "Lagret",
        quizDescription: "",
        quizTimeLimit: null,
        quizTheme: "classic",
        quizIsPublic: false,
      }
    );

    expect(
      template.categories.every((c) => c.questions.every((q) => !q.answered))
    ).toBe(true);
    expect(template.teams.every((t) => t.score === 0)).toBe(true);
    expect(template.jokerTimeLimit).toBe(20);
  });

  it("falls back to three default teams when none are stored", () => {
    const template = templateFromQuizData(
      { categories: [] },
      {
        quizTitle: "Ny",
        quizDescription: "",
        quizTimeLimit: null,
        quizTheme: "classic",
        quizIsPublic: false,
      }
    );

    expect(template.teams).toHaveLength(3);
  });
});

describe("completeness", () => {
  it("counts a joker as complete when it has a task", () => {
    const [historie, mat] = board();
    expect(isQuestionComplete(mat.questions[0])).toBe(true);
    expect(isQuestionComplete(historie.questions[0])).toBe(true);
  });

  it("flags a missing answer and zero points as incomplete", () => {
    const categories: Category[] = [
      {
        name: "Tom",
        questions: [
          {
            points: 0,
            question: "Har spørsmål",
            answer: "",
            answered: false,
            imageUrl: "",
            isJoker: false,
            jokerTask: "",
            jokerTimer: 10,
          },
        ],
      },
    ];

    expect(isQuestionComplete(categories[0].questions[0])).toBe(false);
    expect(countCompleteQuestions(categories)).toBe(0);
  });
});
