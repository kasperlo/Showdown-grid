import React, { useMemo } from "react";
import { useGameStore } from "utils/store";
import { Crown, Medal } from "lucide-react";

type RankedTeam = {
  id: string;
  name: string;
  score: number;
  rank: number; // competition ranking: 1,1,3...
};

function rankTeams(teams: { id: string; name: string; score: number }[]): RankedTeam[] {
  // Sortér stabilt: score desc, navn asc (for forutsigbarhet i ties)
  const sorted = [...teams].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name, "nb");
  });
  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((t, i) => {
    const rank = lastScore === null || t.score < lastScore ? i + 1 : lastRank;
    lastScore = t.score;
    lastRank = rank;
    return { ...t, rank };
  });
}

export default function Results() {
  const { teams } = useGameStore();

  const ranked = useMemo(() => rankTeams(teams), [teams]);
  const hasTeams = ranked.length > 0;

  // Gruppér etter rank 1..3 for podium
  const groups: Record<number, RankedTeam[]> = useMemo(() => {
    const g: Record<number, RankedTeam[]> = {};
    for (const t of ranked) {
      if (!g[t.rank]) g[t.rank] = [];
      g[t.rank].push(t);
    }
    return g;
  }, [ranked]);

  const ranksToShow = [1, 2, 3].filter((r) => !!groups[r]?.length);
  const topScore = ranked[0]?.score ?? 0;

  // Dynamisk søylehøyde per rank (basert på første team sitt score i gruppa)
  const heightForRank = (rank: number) => {
    const score = groups[rank]?.[0]?.score ?? 0;
    const min = 72;  // px
    const max = 220; // px
    if (topScore <= 0) return min;
    const frac = Math.max(0, Math.min(1, score / topScore));
    return Math.round(min + (max - min) * frac);
  };

  const colorForRank = (rank: number) => {
    if (rank === 1) return "bg-accent";
    if (rank === 2) return "bg-muted";
    return "bg-secondary";
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-10">
      <header className="text-center mb-8">
        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight text-accent drop-shadow-sm">
          RESULTATER
        </h1>
        {!hasTeams && (
          <p className="mt-3 text-muted-foreground">Ingen lag enda – spill en runde først.</p>
        )}
      </header>

      {hasTeams && (
        <>
          {/* Toppseksjon: vinner/ere */}
          <section className="text-center mb-10">
            {groups[1]?.length ? (
              <>
                <div className="flex items-center justify-center gap-3 mb-3">
                  <Crown className="w-12 h-12 text-accent" />
                  <h2 className="text-3xl font-semibold">
                    {groups[1].length > 1 ? "Vinnere (uavgjort)" : "Vinner"}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {groups[1].map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center rounded-full border border-border bg-popover px-3 py-1.5 text-sm"
                    >
                      {t.name}
                      <span className="ml-2 text-accent font-bold">{t.score} pts</span>
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          {/* Podium 1–3 med dynamiske høyder og støtte for flere lag per plassering */}
          <section className="mb-14">
            <div className="flex items-end justify-center gap-3 w-full max-w-5xl mx-auto">
              {ranksToShow.map((rank, idx) => {
                const height = heightForRank(rank);
                const color = colorForRank(rank);
                const order =
                  rank === 1 ? "order-2" : rank === 2 ? "order-1" : "order-3"; // midterste høyest
                return (
                  <div
                    key={`rank-col-${rank}`}
                    className={`flex flex-col items-center ${order} animate-slide-up`}
                  >
                    <div className="text-center z-10 mb-3">
                      <p className="text-4xl font-bold">{rank}</p>
                      {/* Lag-chips for denne ranken */}
                      <div className="mt-1 flex flex-wrap gap-1.5 justify-center max-w-[14rem]">
                        {groups[rank].map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center rounded-full border border-border bg-popover px-2.5 py-1 text-xs"
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div
                      className={`w-40 sm:w-48 rounded-t-xl shadow-2xl border border-border ${color}`}
                      style={{ height }}
                    />
                  </div>
                );
              })}
            </div>
            {/* Små “medaljer” under podium for visuell forklaring */}
            <div className="mt-4 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Crown className="w-4 h-4 text-accent" /> 1.
              </span>
              <span className="inline-flex items-center gap-1">
                <Medal className="w-4 h-4 text-muted-foreground" /> 2.
              </span>
              <span className="inline-flex items-center gap-1">
                <Medal className="w-4 h-4 text-secondary" /> 3.
              </span>
            </div>
          </section>

          {/* Full leaderboard med korrekte plass-siffer (1,1,3 …) */}
          <section className="max-w-3xl mx-auto">
            <h3 className="text-center text-xl font-semibold mb-4">Leaderboard</h3>
            <div className="rounded-2xl border border-border bg-card shadow-sm divide-y divide-border">
              {ranked.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-4 py-3 bg-popover/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={[
                        "w-9 shrink-0 text-center text-lg font-bold",
                        t.rank === 1
                          ? "text-accent"
                          : t.rank === 2
                          ? "text-muted-foreground"
                          : t.rank === 3
                          ? "text-secondary"
                          : "text-foreground/70",
                      ].join(" ")}
                    >
                      {t.rank}
                    </span>
                    <span className="font-medium truncate">{t.name}</span>
                  </div>
                  <span className="text-accent font-semibold">{t.score} pts</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}