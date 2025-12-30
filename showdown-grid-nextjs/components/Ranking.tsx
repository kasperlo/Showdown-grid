"use client";

import React, { useMemo, useState } from "react";
import { useGameStore } from "@/utils/store";
import type { Team } from "@/utils/types";
import { Trophy } from "lucide-react";
import { TeamAdjustmentModal } from "./TeamAdjustmentModal";

export function Ranking() {
  const { teams } = useGameStore();
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => b.score - a.score),
    [teams]
  );

  const rankColors = ["text-accent", "text-muted-foreground", "text-primary"];

  return (
    <div className="w-full p-6 rounded-2xl glass">
      <h2 className="text-3xl font-bold text-accent mb-6 text-center tracking-wide">
        Rankings
      </h2>
      <div className="space-y-4">
        {sortedTeams.map((team, index) => (
          <button
            key={team.id}
            onClick={() => setSelectedTeam(team)}
            className="flex items-center justify-between tile p-4 w-full hover:bg-accent/10 transition-colors cursor-pointer"
          >
            <div className="flex items-center">
              <span className="text-2xl font-bold w-8 text-muted-foreground">
                {index + 1}
              </span>
              <p className="font-semibold text-lg ml-4">{team.name}</p>
            </div>
            {index < 3 && (
              <Trophy className={`h-6 w-6 ${rankColors[index] || "text-muted-foreground"}`} />
            )}
          </button>
        ))}
      </div>

      <TeamAdjustmentModal team={selectedTeam} onClose={() => setSelectedTeam(null)} />
    </div>
  );
}