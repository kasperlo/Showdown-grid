"use client";

import { useEffect } from "react";
import { useGameStore } from "@/utils/store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const quizTheme = useGameStore((state) => state.quizTheme);

  useEffect(() => {
    // Apply theme to document element
    document.documentElement.setAttribute("data-theme", quizTheme);
  }, [quizTheme]);

  return <>{children}</>;
}
