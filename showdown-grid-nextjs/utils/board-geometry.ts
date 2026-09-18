/**
 * The board's geometry, computed once and shared by every component that
 * renders it — the play board (GameStage/GameBoard) and the editor board
 * (Del 5). Height drives the tile size; width only caps it. See
 * docs/superpowers/specs/2026-09-18-redesign-spillmodus.md, "Del 1", for the
 * derivation of these constants and the acceptance table this is tested
 * against.
 */
export const BOARD_GEOMETRY = {
  /** Top bar: the 48px row plus its 3px progress line. */
  BAR: 51,
  /** Vertical padding on the content row, top and bottom. */
  PAD: 12,
  /** Horizontal padding on the content row, each side. */
  SIDE: 24,
  /** Bottom dock row — always reserved, even when it holds nothing. */
  DOCK: 128,
  /** Gap between tiles, and between the board and the standings panel's row. */
  GAP: 12,
  /** Gap between the board and the standings panel, when the panel is beside it. */
  PANELGAP: 20,
  /** A category header's height as a fraction of one tile's height. */
  HEADF: 0.62,
  /** The widest a tile is allowed to be, as a multiple of its height. */
  ASPECT: 1.9,
  /** The narrowest a column can be and still read from the back of a room. */
  MINCOL: 140,
} as const;

export interface BoardGeometryInput {
  viewportWidth: number;
  viewportHeight: number;
  categoryCount: number;
  maxRows: number;
}

export interface BoardGeometry {
  panelBeside: boolean;
  panelWidth: number;
  boardHeight: number;
  tileHeight: number;
  headerHeight: number;
  columnWidth: number;
  boardWidth: number;
  marginPerSide: number;
}

export function computeBoardGeometry({
  viewportWidth,
  viewportHeight,
  categoryCount,
  maxRows,
}: BoardGeometryInput): BoardGeometry {
  const { BAR, PAD, SIDE, DOCK, GAP, PANELGAP, HEADF, ASPECT, MINCOL } =
    BOARD_GEOMETRY;
  const N = Math.max(1, categoryCount);
  const R = Math.max(1, maxRows);

  const panelWidth = Math.round(clamp(272, 0.19 * viewportWidth, 432));
  const rowAvailable = viewportWidth - 2 * SIDE;
  const panelBeside =
    N * MINCOL + (N - 1) * GAP + panelWidth + PANELGAP <= rowAvailable;

  const avail = rowAvailable - (panelBeside ? panelWidth + PANELGAP : 0);

  const boardHeight = viewportHeight - BAR - 2 * PAD - DOCK;
  const tileHeight = Math.floor((boardHeight - (R + 1) * GAP) / (R + HEADF));
  const headerHeight = Math.round(tileHeight * HEADF);
  const columnWidth = Math.floor(
    Math.min(tileHeight * ASPECT, (avail - (N - 1) * GAP) / N)
  );

  const boardWidth = N * columnWidth + (N - 1) * GAP;
  const contentWidth = panelBeside
    ? boardWidth + PANELGAP + panelWidth
    : boardWidth;
  const marginPerSide = Math.floor((rowAvailable - contentWidth) / 2);

  return {
    panelBeside,
    panelWidth,
    boardHeight,
    tileHeight,
    headerHeight,
    columnWidth,
    boardWidth,
    marginPerSide,
  };
}

/** The CSS custom properties every board-geometry consumer reads via var(). */
export function boardGeometryCssVars(
  geometry: BoardGeometry
): Record<string, string> {
  return {
    "--tile-h": `${geometry.tileHeight}px`,
    "--head-h": `${geometry.headerHeight}px`,
    "--col-w": `${geometry.columnWidth}px`,
    "--panel-w": `${geometry.panelWidth}px`,
  };
}

function clamp(min: number, value: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
