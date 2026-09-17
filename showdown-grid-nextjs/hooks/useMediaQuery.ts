import { useCallback, useSyncExternalStore } from "react";

/**
 * Mounts a component for one breakpoint only.
 *
 * `hidden xl:block` is not enough when the two variants are a panel and a
 * Sheet: the Sheet's overlay still renders and dims the page behind the desktop
 * panel, and both copies mount, so both register the same keyboard shortcuts.
 *
 * useSyncExternalStore rather than an effect with setState: matchMedia *is* an
 * external store, and reading it this way avoids a render pass where the value
 * is still the server's guess.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query]
  );

  // There is no viewport on the server, so the narrow layout is the server
  // guess; it corrects itself on hydration.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Tailwind's `xl`. Above this the inspector is a column, below it a sheet. */
export function useIsWideScreen(): boolean {
  return useMediaQuery("(min-width: 1280px)");
}
