const INDENT = "  ";

export interface CodeEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Tab and Shift+Tab in the code field. A bare caret gets two spaces. A
 * selection indents, or outdents, every line it touches instead of being
 * replaced, and Shift+Tab on a caret outdents its line.
 */
export function indentCode(
  value: string,
  start: number,
  end: number,
  outdent: boolean
): CodeEdit {
  if (start === end && !outdent) {
    const caret = start + INDENT.length;
    return {
      value: value.slice(0, start) + INDENT + value.slice(end),
      selectionStart: caret,
      selectionEnd: caret,
    };
  }

  const blockStart = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
  // A selection that ends where a line begins does not touch that line.
  const lastTouched = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const lineBreak = value.indexOf("\n", lastTouched);
  const blockEnd = lineBreak === -1 ? value.length : lineBreak;

  const edits: { at: number; removed: number; added: number }[] = [];
  let lineStart = blockStart;
  const lines = value
    .slice(blockStart, blockEnd)
    .split("\n")
    .map((line) => {
      const removed = outdent ? leadingIndent(line) : 0;
      const added = !outdent && line ? INDENT.length : 0;
      edits.push({ at: lineStart, removed, added });
      lineStart += line.length + 1;
      return (added ? INDENT : "") + line.slice(removed);
    });

  // Where a position in the old text ends up. A position at the very start
  // of a line stays before the indent added there.
  const moved = (position: number) =>
    edits.reduce(
      (next, edit) =>
        edit.at < position
          ? next + edit.added - Math.min(edit.removed, position - edit.at)
          : next,
      position
    );

  return {
    value: value.slice(0, blockStart) + lines.join("\n") + value.slice(blockEnd),
    selectionStart: moved(start),
    selectionEnd: moved(end),
  };
}

function leadingIndent(line: string): number {
  if (line.startsWith("\t")) return 1;
  return line.startsWith(INDENT) ? INDENT.length : line.startsWith(" ") ? 1 : 0;
}
