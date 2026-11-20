import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "../store";
import { emptyQuestion, extractTemplate, templateFingerprint } from "../quiz-template";
import type { Category, Team } from "../types";

function column(id: string, name: string, points = [100, 200, 300, 400, 500]): Category {
  return {
    id,
    name,
    questions: points.map((p) => ({ ...emptyQuestion(p), question: "q", answer: "a" })),
  };
}

function fourTeams(): Team[] {
  return ["a", "b", "c", "d"].map((id) => ({
    id,
    name: `Lag ${id.toUpperCase()}`,
    score: 0,
    players: [],
  }));
}

const s = () => useGameStore.getState();

function reset(overrides: Partial<ReturnType<typeof s>> = {}) {
  useGameStore.setState({
    categories: [column("geo", "Geografi"), column("mus", "Musikk")],
    teams: fourTeams(),
    lastQuestion: null,
    roundStep: null,
    round: {
      active: false,
      positiveTeamId: null,
      negativeAwardedTo: [],
      entryIds: [],
      positiveEntryId: null,
    },
    adjustmentLog: [],
    currentTurnTeamId: null,
    isInitialTurnSelection: false,
    turnRule: "winner",
    lastCompletedRound: null,
    lastActionAt: null,
    activeQuizId: null,
    activeRunId: null,
    selectedCard: null,
    queue: null,
    ...overrides,
  });
}

function playTo(categoryId: string, index: number, award = true) {
  const category = s().categories.find((c) => c.id === categoryId)!;
  s().setLastQuestion({
    categoryId,
    categoryName: category.name,
    questionIndex: index,
    points: category.questions[index].points,
    question: "q",
    answer: "a",
  });
  s().advanceRoundStep();
  if (award) s().advanceRoundStep();
}

beforeEach(() => reset());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a round that is cancelled", () => {
  it("takes back a penalty given in the round and leaves the card playable", () => {
    playTo("geo", 0);
    s().awardNegative("c");
    expect(s().teams.find((t) => t.id === "c")!.score).toBe(-50);

    s().cancelRound();

    expect(s().teams.find((t) => t.id === "c")!.score).toBe(0);
    expect(s().adjustmentLog).toHaveLength(0);
    expect(s().categories[0].questions[0].answered).toBe(false);
    expect(s().roundStep).toBeNull();
  });

  it("leaves points from earlier rounds alone", () => {
    s().manualAdjustScore("c", 200, "bonus");
    playTo("geo", 0);
    s().awardNegative("c");
    s().cancelRound();

    expect(s().teams.find((t) => t.id === "c")!.score).toBe(200);
    expect(s().adjustmentLog).toHaveLength(1);
  });
});

describe("undoing the last card", () => {
  it("takes back its points, reopens the card and gives the turn back", () => {
    s().setCurrentTurn("d");
    playTo("geo", 1);
    s().awardNegative("b");
    s().awardPositive("a");
    s().endRound();
    expect(s().currentTurnTeamId).toBe("a");

    s().undoLastCard();

    expect(s().teams.map((t) => t.score)).toEqual([0, 0, 0, 0]);
    expect(s().categories[0].questions[1].answered).toBe(false);
    expect(s().currentTurnTeamId).toBe("d");
    expect(s().lastCompletedRound).toBeNull();
  });
});

describe("undoing the first card", () => {
  it("leaves the turn empty again when nobody had it before the card", () => {
    playTo("geo", 0);
    s().awardPositive("b");
    s().endRound();
    expect(s().currentTurnTeamId).toBe("b");

    s().undoLastCard();
    expect(s().currentTurnTeamId).toBeNull();
  });
});

describe("who picks next", () => {
  it("winner rule: the team that answered picks, a card nobody won passes it on in order", () => {
    s().setCurrentTurn("d");
    playTo("geo", 0);
    s().awardPositive("a");
    s().endRound();
    expect(s().currentTurnTeamId).toBe("a");

    playTo("mus", 0);
    s().endRound();
    expect(s().currentTurnTeamId).toBe("b");
  });

  it("rotation rule: the teams take turns in order whoever answers", () => {
    s().setTurnRule("rotation");
    s().setCurrentTurn("d");
    playTo("geo", 0);
    s().awardPositive("b");
    s().endRound();
    expect(s().currentTurnTeamId).toBe("a");

    playTo("mus", 0);
    s().awardPositive("c");
    s().endRound();
    expect(s().currentTurnTeamId).toBe("b");
  });

  it("never starts a random draw in the middle of a game", () => {
    vi.useFakeTimers();
    playTo("geo", 0);
    s().endRound();

    expect(s().isInitialTurnSelection).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(s().currentTurnTeamId).toBeNull();
  });

  it("a second draw replaces the first instead of both landing", () => {
    vi.useFakeTimers();
    const random = vi.spyOn(Math, "random");
    random.mockReturnValueOnce(0.1);
    s().initializeTurn();
    vi.advanceTimersByTime(1500);
    random.mockReturnValueOnce(0.9);
    s().initializeTurn();
    vi.advanceTimersByTime(1500);

    expect(s().isInitialTurnSelection).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(s().currentTurnTeamId).toBe("d");
    vi.advanceTimersByTime(5000);
    expect(s().currentTurnTeamId).toBe("d");
  });

  it("removing the team that has the turn hands it to the next team", () => {
    s().setCurrentTurn("b");
    s().removeTeam("b");
    expect(s().currentTurnTeamId).toBe("c");
  });
});

describe("editing a column", () => {
  it("adds a card one step above the top instead of shifting every card down", () => {
    s().addQuestionToCategory(0);
    expect(s().categories[0].questions.map((q) => q.points)).toEqual([
      100, 200, 300, 400, 500, 600,
    ]);
  });

  it("builds a column card by card", () => {
    reset({ categories: [column("one", "Én", [100])] });
    s().addQuestionToCategory(0);
    s().addQuestionToCategory(0);
    expect(s().categories[0].questions.map((q) => q.points)).toEqual([100, 200, 300]);
  });

  it("closes the gap when a card is removed from an evenly spaced column", () => {
    s().removeQuestionFromCategory(0, 2);
    expect(s().categories[0].questions.map((q) => q.points)).toEqual([100, 200, 300, 400]);
  });

  it("keeps hand-picked values when the column was not evenly spaced", () => {
    reset({ categories: [column("one", "Én", [100, 300, 600, 1000])] });
    s().removeQuestionFromCategory(0, 1);
    expect(s().categories[0].questions.map((q) => q.points)).toEqual([100, 600, 1000]);
  });

  it("never names a new category after one that exists", () => {
    reset({
      categories: [
        column("k2", "Kategori 2"),
        column("k3", "Kategori 3"),
      ],
    });
    s().addCategory();
    const names = s().categories.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives a duplicated category its own id", () => {
    s().duplicateCategory(0);
    const ids = s().categories.map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("keeps the selected card when its column moves", () => {
    s().selectCard({ categoryIndex: 0, questionIndex: 2 });
    s().moveCategory(0, 1);
    expect(s().selectedCard).toEqual({ categoryIndex: 1, questionIndex: 2 });
  });
});

describe("answered cards and category names", () => {
  it("playing a card in one of two equally named columns leaves the other alone", () => {
    reset({ categories: [column("x", "Musikk"), column("y", "Musikk")] });
    playTo("x", 0);
    s().awardPositive("a");
    s().endRound();

    expect(s().categories[0].questions[0].answered).toBe(true);
    expect(s().categories[1].questions[0].answered).toBe(false);
  });
});

describe("resetting with a running session", () => {
  it("keeps the board when the session could not be saved", async () => {
    reset({ activeQuizId: "quiz", activeRunId: "run" });
    s().manualAdjustScore("a", 300);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));

    const ok = await s().resetGame();

    expect(ok).toBe(false);
    expect(s().teams.find((t) => t.id === "a")!.score).toBe(300);
    expect(s().activeRunId).toBe("run");
  });

  it("a late answer for a run the tab has left does not wipe the current game", async () => {
    reset({ activeQuizId: "quiz", activeRunId: "new-run" });
    s().manualAdjustScore("a", 300);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ run: { id: "old-run" } })))
    );

    await s().completeSession("old-run");

    expect(s().teams.find((t) => t.id === "a")!.score).toBe(300);
    expect(s().activeRunId).toBe("new-run");
  });
});

describe("starting a session the server already has", () => {
  it("continues the game in it instead of writing this board over it", async () => {
    reset({ activeQuizId: "quiz", activeRunId: null });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            reused: true,
            run: {
              id: "run",
              started_at: new Date().toISOString(),
              final_state: {
                answeredKeys: ["id:geo|0"],
                scores: { a: 100 },
                adjustmentLog: [],
                currentTurnTeamId: "a",
              },
            },
          })
        )
      )
    );

    await s().startSession();

    expect(s().activeRunId).toBe("run");
    expect(s().teams.find((t) => t.id === "a")!.score).toBe(100);
    expect(s().categories[0].questions[0].answered).toBe(true);
  });
});

describe("saving the quiz", () => {
  function loaded() {
    reset({
      activeQuizId: "quiz",
      activeQuizCanEdit: true,
      isPlayingPublicQuiz: false,
      quizTitle: "Quiz",
      quizUpdatedAt: "t1",
      saveConflict: false,
    });
    useGameStore.setState({
      templateBaseline: templateFingerprint(extractTemplate(s())),
    });
  }

  it("sends the version it loaded and stores the one it gets back", async () => {
    loaded();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.expectedUpdatedAt).toBe("t1");
      return new Response(JSON.stringify({ quiz: { updated_at: "t2" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    s().renameCategory(0, "Geo");

    expect(await s().saveTemplate()).toBe(true);
    expect(s().quizUpdatedAt).toBe("t2");
    expect(await s().saveTemplate()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops and says so when someone else saved the quiz in the meantime", async () => {
    loaded();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "x" }), { status: 409 }))
    );
    s().renameCategory(0, "Geo");

    expect(await s().saveTemplate()).toBe(false);
    expect(s().saveConflict).toBe(true);
    expect(s().saveStatus).toBe("error");
  });

  it("leaves an empty title out instead of failing the whole save", async () => {
    loaded();
    let sent: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        sent = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ quiz: { updated_at: "t2" } }));
      })
    );
    s().setQuizTitle("   ");
    s().renameCategory(0, "Geo");

    await s().saveTemplate();
    expect("title" in sent).toBe(false);
    expect((sent.quizData as { categories: Category[] }).categories[0].name).toBe("Geo");
  });

  it("runs saves one after another, each with the version the last one got", async () => {
    loaded();
    const seen: string[] = [];
    let version = 1;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        seen.push(JSON.parse(String(init?.body)).expectedUpdatedAt);
        await new Promise((resolve) => setTimeout(resolve, 5));
        version += 1;
        return new Response(JSON.stringify({ quiz: { updated_at: `t${version}` } }));
      })
    );

    s().renameCategory(0, "A");
    const first = s().saveTemplate();
    // The second edit lands while the first save is on its way.
    await new Promise((resolve) => setTimeout(resolve, 1));
    s().renameCategory(0, "B");
    const second = s().saveTemplate();
    await Promise.all([first, second]);

    expect(seen).toEqual(["t1", "t2"]);
  });
});

describe("a game played before the first card", () => {
  it("comes back after a reload when the server has no session", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => void storage.set(k, v),
        removeItem: (k: string) => void storage.delete(k),
      },
    });
    reset({ activeQuizId: "quiz" });
    s().setCurrentTurn("c");

    reset({ activeQuizId: "quiz" });
    expect(s().currentTurnTeamId).toBeNull();
    s().applySnapshotWithoutRun("quiz");

    expect(s().currentTurnTeamId).toBe("c");
  });
});
