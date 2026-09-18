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
