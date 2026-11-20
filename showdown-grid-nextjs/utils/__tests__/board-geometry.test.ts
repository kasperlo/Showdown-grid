import { describe, expect, it } from "vitest";
import { computeBoardGeometry } from "../board-geometry";

describe("computeBoardGeometry", () => {
  // Del 1's table reserved the 128px dock row even with the standings beside
  // the board; the board now gets that height, so these two rows differ from
  // the table in the spec.
  it("5 categories x 5 rows @ 1920x1080, panel beside, no dock row", () => {
    const g = computeBoardGeometry({
      viewportWidth: 1920,
      viewportHeight: 1080,
      categoryCount: 5,
      maxRows: 5,
    });

    expect(g.panelBeside).toBe(true);
    expect(g.boardHeight).toBe(1005);
    expect(g.columnWidth).toBe(287);
    expect(g.tileHeight).toBe(166);
    expect(g.boardWidth).toBe(1483);
    expect(g.panelWidth).toBe(365);
    expect(g.marginPerSide).toBe(2);
  });

  it("4 categories x 5 rows @ 2560x1440, panel beside, no dock row", () => {
    const g = computeBoardGeometry({
      viewportWidth: 2560,
      viewportHeight: 1440,
      categoryCount: 4,
      maxRows: 5,
    });

    expect(g.panelBeside).toBe(true);
    expect(g.columnWidth).toBe(437);
    expect(g.tileHeight).toBe(230);
    expect(g.boardWidth).toBe(1784);
    expect(g.panelWidth).toBe(432);
    expect(g.marginPerSide).toBe(138);
  });

  it("matches the acceptance table: 7 categories x 5 rows @ 1366x768, panel in the bottom row", () => {
    const g = computeBoardGeometry({
      viewportWidth: 1366,
      viewportHeight: 768,
      categoryCount: 7,
      maxRows: 5,
    });

    expect(g.panelBeside).toBe(false);
    expect(g.columnWidth).toBe(165);
    expect(g.tileHeight).toBe(87);
    expect(g.boardWidth).toBe(1227);
    expect(g.marginPerSide).toBe(45);
  });

  it("never lets the board scroll: column width stays within the space available for it", () => {
    const g = computeBoardGeometry({
      viewportWidth: 1920,
      viewportHeight: 1080,
      categoryCount: 5,
      maxRows: 5,
    });

    const rowAvailable = 1920 - 2 * 24;
    const contentWidth = g.panelBeside
      ? g.boardWidth + 20 + g.panelWidth
      : g.boardWidth;

    expect(contentWidth).toBeLessThanOrEqual(rowAvailable);
  });

  it("caps a single wide category by aspect ratio instead of stretching it to fill the row", () => {
    const g = computeBoardGeometry({
      viewportWidth: 3440,
      viewportHeight: 1440,
      categoryCount: 3,
      maxRows: 5,
    });

    // ASPECT=1.9 caps column width at 1.9x the tile height, however much
    // horizontal room three categories leave on an ultrawide screen.
    expect(g.columnWidth).toBeLessThanOrEqual(Math.floor(g.tileHeight * 1.9));
  });

  it("uses an explicit panelWidth instead of computing one, and treats the panel as always beside the board", () => {
    const g = computeBoardGeometry({
      viewportWidth: 1920,
      viewportHeight: 1080,
      categoryCount: 5,
      maxRows: 5,
      panelWidth: 460,
    });

    expect(g.panelWidth).toBe(460);
    expect(g.panelBeside).toBe(true);
  });

  it("uses boardHeightOverride instead of BAR/PAD/DOCK when given", () => {
    const withOverride = computeBoardGeometry({
      viewportWidth: 1920,
      viewportHeight: 1080,
      categoryCount: 5,
      maxRows: 5,
      boardHeightOverride: 700,
    });
    const withoutOverride = computeBoardGeometry({
      viewportWidth: 1920,
      viewportHeight: 1080,
      categoryCount: 5,
      maxRows: 5,
    });

    expect(withOverride.boardHeight).toBe(700);
    expect(withOverride.tileHeight).not.toBe(withoutOverride.tileHeight);
  });

  it("panelWidth and boardHeightOverride are both optional and don't change Del 1's numbers when omitted", () => {
    const g = computeBoardGeometry({
      viewportWidth: 1920,
      viewportHeight: 1080,
      categoryCount: 5,
      maxRows: 5,
    });

    expect(g.panelWidth).toBe(365);
    expect(g.columnWidth).toBe(287);
  });
});
