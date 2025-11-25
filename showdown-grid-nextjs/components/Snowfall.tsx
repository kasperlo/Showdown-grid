"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/utils/store";

interface Snowflake {
  id: number;
  left: string;
  animationDuration: string;
  animationDelay: string;
  fontSize: string;
  symbol: string;
}

const snowSymbols = ["❄", "❅", "❆", "✻", "✼", "❉"];

export function Snowfall() {
  const quizTheme = useGameStore((state) => state.quizTheme);
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);

  useEffect(() => {
    if (quizTheme === "christmas") {
      // Generate 25 random snowflakes with varied symbols
      const flakes: Snowflake[] = Array.from({ length: 25 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        animationDuration: `${10 + Math.random() * 15}s`,
        animationDelay: `${Math.random() * 8}s`,
        fontSize: `${0.8 + Math.random() * 1.2}rem`,
        symbol: snowSymbols[Math.floor(Math.random() * snowSymbols.length)],
      }));
      setSnowflakes(flakes);
    } else {
      setSnowflakes([]);
    }
  }, [quizTheme]);

  if (quizTheme !== "christmas") return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[1000]">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="snowflake"
          style={{
            left: flake.left,
            animationDuration: flake.animationDuration,
            animationDelay: flake.animationDelay,
            fontSize: flake.fontSize,
          }}
        >
          {flake.symbol}
        </div>
      ))}
    </div>
  );
}
