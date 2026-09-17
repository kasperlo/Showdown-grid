import { describe, expect, it } from "vitest";
import { parseBoardText, parseExportedBoard } from "../board-import";

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
  it("fills in defaults for a minimal file", () => {
    const board = parseExportedBoard(
      JSON.stringify({
        categories: [{ name: "Mat", questions: [{ points: 100 }] }],
      })
    );

    expect(board.title).toBe("");
    expect(board.jokerTimeLimit).toBe(10);
    expect(board.categories[0].questions[0].answered).toBe(false);
    expect(board.categories[0].questions[0].question).toBe("");
  });

  it("refuses a file without categories", () => {
    expect(() => parseExportedBoard(JSON.stringify({ title: "x" }))).toThrow(
      /categories/
    );
  });
});
