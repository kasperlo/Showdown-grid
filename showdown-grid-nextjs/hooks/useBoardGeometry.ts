import { useCallback, useMemo, useSyncExternalStore } from "react";
import { computeBoardGeometry, type BoardGeometry } from "@/utils/board-geometry";

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

export function useBoardGeometry(
  categoryCount: number,
  maxRows: number
): BoardGeometry {
  const viewportWidth = useViewportWidth();
  const viewportHeight = useViewportHeight();

  return useMemo(
    () =>
      computeBoardGeometry({
        viewportWidth,
        viewportHeight,
        categoryCount,
        maxRows,
      }),
    [viewportWidth, viewportHeight, categoryCount, maxRows]
  );
}
