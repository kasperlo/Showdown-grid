import { useCallback, useEffect, useState } from "react";

export interface PresentationMode {
  active: boolean;
  enter: () => void;
  exit: () => void;
}

/**
 * Strips the app's own chrome and takes the browser fullscreen with it.
 *
 * The two are deliberately one control: the reason to hide the library and
 * account buttons is that a projector is showing them to the whole room, and
 * the browser's tabs and address bar are on that projector too. Hiding one
 * without the other solves half a problem.
 */
export function usePresentationMode(): PresentationMode {
  const [active, setActive] = useState(false);

  // Leaving fullscreen with Escape or F11 has to leave the mode as well.
  // Otherwise the chrome stays hidden with no visible way back to it.
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setActive(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const enter = useCallback(() => {
    setActive(true);
    // Fullscreen can be refused outright — a permissions policy, or iOS Safari,
    // where the element API does not exist. Hiding the chrome still helps.
    void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const exit = useCallback(() => {
    setActive(false);
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
  }, []);

  return { active, enter, exit };
}
