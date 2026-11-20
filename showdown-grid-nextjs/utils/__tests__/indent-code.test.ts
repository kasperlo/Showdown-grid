import { describe, expect, it } from "vitest";
import { indentCode } from "../../components/editor/indent-code";

describe("indentCode", () => {
  it("inserts two spaces at a bare caret", () => {
    expect(indentCode("ab", 1, 1, false)).toEqual({
      value: "a  b",
      selectionStart: 3,
      selectionEnd: 3,
    });
  });

  it("indents every line a selection touches instead of replacing it", () => {
    const value = "one\ntwo\nthree";
    const edit = indentCode(value, 1, 6, false);
    expect(edit.value).toBe("  one\n  two\nthree");
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe("ne\n  tw");
  });

  it("does not touch the line a selection ends at the start of", () => {
    expect(indentCode("one\ntwo", 0, 4, false).value).toBe("  one\ntwo");
  });

  it("outdents the selected lines, and the caret's line without a selection", () => {
    expect(indentCode("  one\n  two", 0, 11, true).value).toBe("one\ntwo");
    expect(indentCode("a\n  b", 4, 4, true).value).toBe("a\nb");
  });
});
