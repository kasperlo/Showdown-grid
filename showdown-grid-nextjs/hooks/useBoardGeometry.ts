import { useMemo, useSyncExternalStore } from "react";
import {
  clamp,
  computeBoardGeometry,
  type BoardGeometry,
} from "@/utils/board-geometry";

/**
 * Same technique as useMediaQuery: window size is an external store, read
 * with useSyncExternalStore rather than an effect with setState. Two
 * separate primitive stores (not one object) so a resize that doesn't
 * change, say, the height doesn't force a new geometry object on width-only
 * reads elsewhere.
 */
function useViewportWidth(): number {
  return useSyncExternalStore(
    subscribeToResize,
    () => window.innerWidth,
    () => 1280
  );
}

function useViewportHeight(): number {
  return useSyncExternalStore(
    subscribeToResize,
    () => window.innerHeight,
    () => 800
  );
}

function subscribeToResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

export interface UseBoardGeometryOptions {
  /** [min, fractionOfViewportWidth, max] — the editor's floating panel,
   * clamp(360px, 24vw, 460px), is passed as [360, 0.24, 460]. */
  panelWidthClamp?: [number, number, number];
  boardHeightOverride?: number;
}

export function useBoardGeometry(
  categoryCount: number,
  maxRows: number,
  options?: UseBoardGeometryOptions
): BoardGeometry {
  const viewportWidth = useViewportWidth();
  const viewportHeight = useViewportHeight();
  const panelWidthClamp = options?.panelWidthClamp;
  const boardHeightOverride = options?.boardHeightOverride;

  return useMemo(() => {
    const panelWidth = panelWidthClamp
      ? Math.round(
          clamp(
            panelWidthClamp[0],
            panelWidthClamp[1] * viewportWidth,
            panelWidthClamp[2]
          )
        )
      : undefined;

    return computeBoardGeometry({
      viewportWidth,
      viewportHeight,
      categoryCount,
      maxRows,
      panelWidth,
      boardHeightOverride,
    });
  }, [
    viewportWidth,
    viewportHeight,
    categoryCount,
    maxRows,
    panelWidthClamp,
    boardHeightOverride,
  ]);
}
