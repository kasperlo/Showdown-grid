import type { Category } from "./types";
import { emptyQuestion } from "./quiz-template";

/**
 * Turns pasted rows into a board.
 *
 * Writing 25 questions one dialog at a time is the slowest part of making a
 * quiz, and most people already have them in a spreadsheet or a note. One row
 * per question: category, points, question, answer, and optionally a code
 * snippet. Tab-separated (what you get when copying from a spreadsheet),
 * semicolon or comma also work.
 *
 * The import is line-based, so a real newline would end the row. `\n` inside the
 * code column is therefore read as a line break — that is the only way to paste
 * a multi-line snippet without typing it into the card by hand.
 */

export interface ImportResult {
  categories: Category[];
  rowCount: number;
  errors: string[];
}

const SEPARATORS = ["\t", ";", ","] as const;

export function parseBoardText(text: string): ImportResult {
  const errors: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { categories: [], rowCount: 0, errors: ["Ingen rader å lese."] };
  }

  const separator = pickSeparator(lines);
  const order: string[] = [];
  const byCategory = new Map<string, Category>();
  let rowCount = 0;

  lines.forEach((line, index) => {
    const cells = splitLine(line, separator).map((cell) => cell.trim());
    if (cells.length < 2) {
      errors.push(`Rad ${index + 1}: fant bare én kolonne.`);
      return;
    }

    const [
      categoryName,
      pointsRaw,
      questionText = "",
      answerText = "",
      codeText = "",
    ] = cells;
    if (!categoryName) {
      errors.push(`Rad ${index + 1}: kategorinavn mangler.`);
      return;
    }

    // A header row is common when pasting from a spreadsheet; skipping it is
    // friendlier than importing "Poeng" as a category.
    const points = parseInt(pointsRaw, 10);
    if (!Number.isFinite(points)) {
      if (index === 0) return;
      errors.push(`Rad ${index + 1}: «${pointsRaw}» er ikke et tall.`);
      return;
    }

    if (!byCategory.has(categoryName)) {
      byCategory.set(categoryName, { name: categoryName, questions: [] });
      order.push(categoryName);
    }

    const question = emptyQuestion(points);
    question.question = questionText;
    question.answer = answerText;
    question.code = unescapeNewlines(codeText);
    byCategory.get(categoryName)!.questions.push(question);
    rowCount += 1;
  });

  const categories = order
    .map((name) => byCategory.get(name)!)
    .map((category) => ({
      ...category,
      questions: [...category.questions].sort((a, b) => a.points - b.points),
    }));

  if (!categories.length && !errors.length) {
    errors.push("Fant ingen gyldige rader.");
  }

  return { categories, rowCount, errors };
}

/** `\n` typed in a cell becomes a real line break; `\\n` stays literal. */
function unescapeNewlines(value: string): string {
  return value.replace(/\\(\\|n)/g, (_, char) => (char === "n" ? "\n" : "\\"));
}

function pickSeparator(lines: string[]): string {
  const sample = lines.slice(0, 5);
  let best = "\t";
  let bestScore = 0;
  for (const separator of SEPARATORS) {
    const score = sample.reduce(
      (sum, line) => sum + (line.split(separator).length - 1),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      best = separator;
    }
  }
  return best;
}

/** Handles quoted cells so a comma inside a question does not split the row. */
function splitLine(line: string, separator: string): string[] {
  if (separator === "\t") return line.split("\t");

  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === separator && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

export interface ExportedBoard {
  version: 1;
  title: string;
  description: string;
  timeLimit: number | null;
  jokerTimeLimit: number | null;
  categories: Category[];
}

export function serializeBoard(board: ExportedBoard): string {
  return JSON.stringify(board, null, 2);
}

export function parseExportedBoard(json: string): ExportedBoard {
  const parsed = JSON.parse(json) as Partial<ExportedBoard>;
  if (!Array.isArray(parsed.categories)) {
    throw new Error("Fila mangler «categories».");
  }
  return {
    version: 1,
    title: typeof parsed.title === "string" ? parsed.title : "",
    description:
      typeof parsed.description === "string" ? parsed.description : "",
    timeLimit:
      typeof parsed.timeLimit === "number" ? parsed.timeLimit : null,
    jokerTimeLimit:
      typeof parsed.jokerTimeLimit === "number" ? parsed.jokerTimeLimit : 10,
    categories: parsed.categories.map((category) => ({
      name: String(category?.name ?? "Uten navn"),
      questions: Array.isArray(category?.questions)
        ? category.questions.map((question) => ({
            ...emptyQuestion(Number(question?.points) || 100),
            question: String(question?.question ?? ""),
            answer: String(question?.answer ?? ""),
            code: String(question?.code ?? ""),
            imageUrl: String(question?.imageUrl ?? ""),
            isJoker: question?.isJoker === true,
            jokerTask: String(question?.jokerTask ?? ""),
            jokerTimer: Number(question?.jokerTimer) || 10,
          }))
        : [],
    })),
  };
}
