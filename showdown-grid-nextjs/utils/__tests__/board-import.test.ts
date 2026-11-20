import { describe, expect, it } from "vitest";
import {
  parseBoardText,
  parseExportedBoard,
  serializeBoard,
  type ExportedBoard,
} from "../board-import";
import { emptyQuestion } from "../quiz-template";

describe("parseBoardText", () => {
  it("reads tab-separated rows and groups them by category", () => {
    const result = parseBoardText(
      [
        "Historie\t100\tHvem var først?\tOlav",
        "Historie\t200\tHvilket år?\t1905",
        "Mat\t100\tHva er fårikål?\tKjøtt og kål",
      ].join("\n")
    );

    expect(result.errors).toEqual([]);
    expect(result.rowCount).toBe(3);
    expect(result.categories.map((c) => c.name)).toEqual(["Historie", "Mat"]);
    expect(result.categories[0].questions.map((q) => q.points)).toEqual([
      100, 200,
    ]);
    expect(result.categories[0].questions[0].answer).toBe("Olav");
  });

  it("sorts each category by points regardless of paste order", () => {
    const result = parseBoardText(
      ["Mat;300;C;c", "Mat;100;A;a", "Mat;200;B;b"].join("\n")
    );

    expect(result.categories[0].questions.map((q) => q.points)).toEqual([
      100, 200, 300,
    ]);
  });

  it("skips a spreadsheet header row instead of importing it", () => {
    const result = parseBoardText(
      ["Kategori\tPoeng\tSpørsmål\tSvar", "Mat\t100\tA\ta"].join("\n")
    );

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe("Mat");
    expect(result.errors).toEqual([]);
  });

  it("keeps a comma inside a quoted question", () => {
    const result = parseBoardText('Mat,100,"Ost, brød og vin?",Tapas');

    expect(result.categories[0].questions[0].question).toBe(
      "Ost, brød og vin?"
    );
    expect(result.categories[0].questions[0].answer).toBe("Tapas");
  });

  it("reports the row number when the points column is not a number", () => {
    const result = parseBoardText(
      ["Mat\t100\tA\ta", "Mat\tmange\tB\tb"].join("\n")
    );

    expect(result.rowCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Rad 2");
  });

  it("reads a fifth column as a code snippet", () => {
    const result = parseBoardText(
      'Kode\t100\tHva printes?\t"object"\tconsole.log(typeof null)'
    );

    const card = result.categories[0].questions[0];
    expect(card.question).toBe("Hva printes?");
    expect(card.answer).toBe('"object"');
    expect(card.code).toBe("console.log(typeof null)");
  });

  it("reads a sixth column as the explanation", () => {
    const result = parseBoardText(
      "Kode\t500\tHva printes?\ttrue false\tInteger a = 127;\tInteger-cachen dekker -128 til 127"
    );

    const card = result.categories[0].questions[0];
    expect(card.code).toBe("Integer a = 127;");
    expect(card.explanation).toBe("Integer-cachen dekker -128 til 127");
  });

  it("leaves the explanation empty when the column is missing", () => {
    const result = parseBoardText("Mat\t100\tA\ta");
    expect(result.categories[0].questions[0].explanation).toBe("");
  });

  it("turns \\n in the code column into real line breaks", () => {
    const result = parseBoardText(
      "Kode;100;Hva printes?;1 4 3 2;console.log('1')\\nconsole.log('4')"
    );

    expect(result.categories[0].questions[0].code).toBe(
      "console.log('1')\nconsole.log('4')"
    );
  });

  it("leaves an escaped backslash alone", () => {
    const result = parseBoardText("Kode;100;Regex?;ja;/\\\\n/");
    expect(result.categories[0].questions[0].code).toBe("/\\n/");
  });

  it("says so when there is nothing to read", () => {
    expect(parseBoardText("   ").errors).toEqual(["Ingen rader å lese."]);
  });
});

describe("parseExportedBoard", () => {
  it("leaves out the quiz settings a minimal file does not have", () => {
    const board = parseExportedBoard(
      JSON.stringify({
        categories: [{ name: "Mat", questions: [{ points: 100 }] }],
      })
    );

    expect(board).toEqual({
      categories: [
        { name: "Mat", questions: [emptyQuestion(100)] },
      ],
    });
    expect(board.categories[0].questions[0].answered).toBe(false);
    expect(board.categories[0].questions[0].jokerTimer).toBeNull();
  });

  it("reads back everything an export writes", () => {
    const exported: ExportedBoard = {
      version: 1,
      title: "Julequiz",
      description: "For hele familien",
      timeLimit: 90,
      jokerTimeLimit: 20,
      theme: "christmas",
      turnRule: "rotation",
      teams: [
        { name: "Nissene", players: ["Kari", "Ola"] },
        { name: "Reinsdyrene", players: [] },
      ],
      categories: [
        {
          name: "Mat",
          questions: [
            {
              ...emptyQuestion(100),
              question: "Hva er ribbe?",
              answer: "Svinekjøtt",
            },
            { ...emptyQuestion(200), isJoker: true, jokerTask: "Syng", jokerTimer: 30 },
          ],
        },
      ],
    };

    const board = parseExportedBoard(serializeBoard(exported));
    expect(board).toEqual({ ...exported, version: undefined });
  });

  it("leaves out settings that make no sense", () => {
    const board = parseExportedBoard(
      JSON.stringify({
        title: "   ",
        description: 42,
        timeLimit: "60",
        jokerTimeLimit: -5,
        theme: "neon",
        turnRule: "random",
        teams: [],
        categories: [],
      })
    );

    expect(board).toEqual({ categories: [] });
  });

  it("keeps a timer that is switched off", () => {
    const board = parseExportedBoard(
      JSON.stringify({ timeLimit: null, jokerTimeLimit: null, categories: [] })
    );

    expect(board.timeLimit).toBeNull();
    expect(board.jokerTimeLimit).toBeNull();
  });

  it("clamps the timers to what the editor allows", () => {
    const board = parseExportedBoard(
      JSON.stringify({
        timeLimit: 2,
        jokerTimeLimit: 999,
        categories: [
          {
            name: "Mat",
            questions: [
              { points: 100, jokerTimer: 999 },
              { points: 200, jokerTimer: 0.4 },
              { points: 300, jokerTimer: 0 },
              { points: 400, jokerTimer: "10" },
              { points: 500 },
            ],
          },
        ],
      })
    );

    expect(board.timeLimit).toBe(5);
    expect(board.jokerTimeLimit).toBe(300);
    expect(board.categories[0].questions.map((q) => q.jokerTimer)).toEqual([
      300,
      1,
      null,
      null,
      null,
    ]);
  });

  it("reads teams by name and players only", () => {
    const board = parseExportedBoard(
      JSON.stringify({
        teams: [
          { id: "team-9", name: "  Nissene ", score: 900, players: [" Kari ", "", 3] },
          { players: ["Ola"] },
          "Reinsdyrene",
        ],
        categories: [],
      })
    );

    expect(board.teams).toEqual([
      { name: "Nissene", players: ["Kari"] },
      { name: "Lag 2", players: ["Ola"] },
    ]);
  });

  it("refuses a file that is not JSON", () => {
    expect(() => parseExportedBoard("{ categories: [")).toThrow(
      "Fila er ikke gyldig JSON."
    );
  });

  it("refuses a file without categories", () => {
    expect(() => parseExportedBoard(JSON.stringify({ title: "x" }))).toThrow(
      /categories/
    );
  });
});
