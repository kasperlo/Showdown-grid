"use client";

import { useGameStore } from "@/utils/store";
import { QuizTheme } from "@/utils/types";
import { Button } from "./ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const themes: { value: QuizTheme; label: string; colors: string; description: string }[] = [
  {
    value: "classic",
    label: "Klassisk",
    colors: "bg-gradient-to-br from-blue-900 via-blue-700 to-yellow-500",
    description: "Tradisjonell blå og gull",
  },
  {
    value: "modern",
    label: "Moderne",
    colors: "bg-gradient-to-br from-slate-800 via-slate-600 to-blue-500",
    description: "Sleek gråtoner med blå",
  },
  {
    value: "christmas",
    label: "Jul",
    colors: "bg-gradient-to-br from-red-700 via-green-800 to-green-700",
    description: "Klassisk julefarger med snø ❄️",
  },
];

export function ThemeSelector() {
  const { quizTheme, setQuizTheme } = useGameStore();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Tema</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {themes.map((theme) => (
          <button
            key={theme.value}
            onClick={() => setQuizTheme(theme.value)}
            className={cn(
              "relative rounded-lg p-4 transition-all border-2 hover:scale-105",
              quizTheme === theme.value
                ? "border-primary shadow-lg"
                : "border-border hover:border-primary/50"
            )}
          >
            <div className={cn("w-full h-20 rounded-md mb-3", theme.colors)} />
            <div className="text-sm font-medium text-center mb-1">{theme.label}</div>
            <div className="text-xs text-muted-foreground text-center">{theme.description}</div>
            {quizTheme === theme.value && (
              <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                <Check className="h-4 w-4" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
