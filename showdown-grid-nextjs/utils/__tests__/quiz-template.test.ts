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
  withCategoryIds,
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
      answeredKey({ name: "Historie" }, 0),
      answeredKey({ name: "Mat" }, 0),
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

describe("category ids", () => {
  const withIds = (): Category[] =>
    board().map((category, index) => ({ ...category, id: `k${index}` }));

  it("keys answered cards on the category id, so equal names stay apart", () => {
    const categories: Category[] = [
      { ...board()[0], id: "x", name: "Musikk" },
      { ...board()[0], id: "y", name: "Musikk" },
    ];
    categories[1].questions = categories[1].questions.map((q) => ({
      ...q,
      answered: false,
    }));
    const live = extractLiveState({
      categories,
      teams,
      adjustmentLog: [],
      currentTurnTeamId: null,
    });
    const merged = mergeLiveIntoTemplate(
      extractTemplate({ categories, teams, ...meta }),
      live
    );

    expect(live.answeredKeys).toEqual(["id:x|0"]);
    expect(merged.categories[0].questions[0].answered).toBe(true);
    expect(merged.categories[1].questions[0].answered).toBe(false);
  });

  it("keeps used cards used after a rename, since the key no longer has the name", () => {
    const categories = withIds();
    const live = extractLiveState({
      categories,
      teams,
      adjustmentLog: [],
      currentTurnTeamId: null,
    });
    const renamed = categories.map((c) => ({ ...c, name: "" }));
    const merged = mergeLiveIntoTemplate(
      extractTemplate({ categories: renamed, teams, ...meta }),
      live
    );

    expect(merged.categories[0].questions[0].answered).toBe(true);
  });

  it("still reads name keys from runs written before categories had ids", () => {
    const merged = mergeLiveIntoTemplate(
      extractTemplate({ categories: withIds(), teams, ...meta }),
      {
        answeredKeys: ["Historie|1"],
        scores: {},
        adjustmentLog: [],
        currentTurnTeamId: null,
        version: 2,
      }
    );

    expect(merged.categories[0].questions[1].answered).toBe(true);
  });

  it("gives stored categories without ids the same ids on every load", () => {
    const meta2 = {
      quizTitle: "Lagret",
      quizDescription: "",
      quizTimeLimit: null,
      quizTheme: "classic" as const,
      quizIsPublic: false,
    };
    const first = templateFromQuizData({ categories: board() }, meta2);
    const second = templateFromQuizData({ categories: board() }, meta2);

    expect(first.categories.map((c) => c.id)).toEqual(["c0", "c1"]);
    expect(second.categories.map((c) => c.id)).toEqual(["c0", "c1"]);
  });

  it("makes repeated ids unique", () => {
    const ids = withCategoryIds(
      [
        { id: "same", name: "A", questions: [] },
        { id: "same", name: "B", questions: [] },
      ],
      "positional"
    ).map((c) => c.id);

    expect(new Set(ids).size).toBe(2);
  });
});

describe("the teams of a playthrough", () => {
  it("restores a team that exists only in the live state, with its score", () => {
    const template = extractTemplate({ categories: board(), teams, ...meta });
    const merged = mergeLiveIntoTemplate(template, {
      answeredKeys: [],
      scores: { a: 100, late: 300 },
      adjustmentLog: [],
      currentTurnTeamId: "late",
      teams: [
        { id: "a", name: "Alfa", players: [] },
        { id: "late", name: "Kom sent", players: ["Ola"] },
      ],
      version: 2,
    });

    expect(merged.teams.map((t) => [t.name, t.score])).toEqual([
      ["Alfa", 100],
      ["Kom sent", 300],
    ]);
    expect(merged.currentTurnTeamId).toBe("late");
  });

  it("falls back to the quiz's teams for runs without a roster", () => {
    const template = extractTemplate({ categories: board(), teams, ...meta });
    const merged = mergeLiveIntoTemplate(template, {
      answeredKeys: [],
      scores: { a: 50 },
      adjustmentLog: [],
      currentTurnTeamId: null,
      version: 2,
    });

    expect(merged.teams.map((t) => t.name)).toEqual(["Alfa", "Bravo"]);
  });

  it("round-trips the roster and the time of the last action through a run row", () => {
    const live = extractLiveState({
      categories: board(),
      teams,
      adjustmentLog: [],
      currentTurnTeamId: null,
      lastActionAt: 1234,
    });
    const read = liveStateFromRunState(JSON.parse(JSON.stringify(live)));

    expect(read?.teams?.map((t) => t.name)).toEqual(["Alfa", "Bravo"]);
    expect(read?.lastActionAt).toBe(1234);
  });
});

describe("quiz settings in the template", () => {
  const meta2 = {
    quizTitle: "Lagret",
    quizDescription: "",
    quizTimeLimit: null,
    quizTheme: "classic" as const,
    quizIsPublic: false,
  };

  it("defaults the turn rule to the team that answered", () => {
    expect(templateFromQuizData({ categories: [] }, meta2).turnRule).toBe("winner");
    expect(
      templateFromQuizData({ categories: [], turnRule: "rotation" }, meta2).turnRule
    ).toBe("rotation");
  });

  it("reads the old default joker timer of 10 as 'use the quiz default'", () => {
    const template = templateFromQuizData({ categories: board() }, meta2);

    expect(template.categories[0].questions[0].jokerTimer).toBeNull();
    expect(template.categories[1].questions[0].jokerTimer).toBe(15);
  });
});
