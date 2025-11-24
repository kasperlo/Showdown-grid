import React from "react";
import { useGameStore } from "utils/store";
import { Trophy } from "lucide-react";

export function Ranking() {
  const { teams } = useGameStore();
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  const rankColors = ["text-accent", "text-muted-foreground", "text-primary"];

  return (
    <div className="w-full p-6 rounded-2xl glass">
      <h2 className="text-3xl font-bold text-accent mb-6 text-center tracking-wide">
        Rankings
      </h2>
      <div className="space-y-4">
        {sortedTeams.map((team, index) => (
          <div
            key={team.id}
            className="flex items-center justify-between tile p-4"
          >
            <div className="flex items-center">
              <span className={`text-2xl font-bold w-8 ${rankColors[index] || "text-muted-foreground"}`}>
                {index + 1}
              </span>
              <p className="font-semibold text-lg ml-4">{team.name}</p>
            </div>
            <div className="flex items-center">
              <span className="text-2xl font-bold text-accent text-score">
                {team.score}
              </span>
              {index < 3 && (
                <Trophy className={`ml-4 h-6 w-6 ${rankColors[index] || "text-muted-foreground"}`} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}