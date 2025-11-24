import React from "react";
import { GameBoard } from "components/GameBoard";
import { Ranking } from "components/Ranking";
import { RoundDock } from "components/RoundDock";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings, LogOut } from "lucide-react";
import { useGameStore } from "utils/store";
import { useUserGuardContext } from "app/auth";
import { stackClientApp } from "app/auth";

export default function App() {
  const navigate = useNavigate();
  const { gameTitle, gameDescription } = useGameStore();
  const { user } = useUserGuardContext();

  return (
    <main className="stage min-h-screen">
      <div className="container mx-auto p-4 md:p-8">
        <header className="text-center mb-10 relative">
          <h1 className="display-xl text-accent drop-shadow-sm">{gameTitle}</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {gameDescription}
          </p>
          <div className="absolute top-0 right-0 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/setup")}
              aria-label="Åpne oppsett"
              title="Oppsett"
            >
              <Settings className="h-8 w-8" />
            </Button>
            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => stackClientApp.signOut()}
                aria-label="Logg ut"
                title="Logg ut"
              >
                <LogOut className="h-8 w-8" />
              </Button>
            )}
          </div>
        </header>

        <section className="mb-10">
          <GameBoard />
        </section>

        {/* Én, ryddig seksjon for poengtavle: Ranking i full bredde */}
        <section className="mt-12">
          <Ranking />
        </section>

        <div className="mt-16 text-center">
          <Button
            onClick={() => navigate("/results")}
            className="bg-accent text-accent-foreground font-bold text-2xl px-12 py-6 rounded-xl shadow-lg transition-transform hover:scale-105"
          >
            RESULTATER
          </Button>
        </div>
      </div>

      {/* Minimalistisk dokk for poengtildeling under runder */}
      <RoundDock />
    </main>
  );
}
