"use client";

import { useState } from "react";
import { useGameStore } from "@/utils/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, RotateCcw, Trash2, Users } from "lucide-react";

export function TeamsEditor() {
  const teams = useGameStore((s) => s.teams);
  const addTeam = useGameStore((s) => s.addTeam);
  const removeTeam = useGameStore((s) => s.removeTeam);
  const updateTeamName = useGameStore((s) => s.updateTeamName);
  const updateTeamPlayers = useGameStore((s) => s.updateTeamPlayers);
  const resetGame = useGameStore((s) => s.resetGame);
  const [teamToRemove, setTeamToRemove] = useState<string | null>(null);

  const totalScore = teams.reduce((sum, t) => sum + t.score, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Users className="h-5 w-5" />
          Lag ({teams.length})
        </h2>
        <Button onClick={() => addTeam()} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Legg til lag
        </Button>
      </div>

      {teams.length === 0 ? (
        <p className="glass rounded-xl p-8 text-center text-muted-foreground">
          Ingen lag enda. Du trenger minst ett for å spille.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {teams.map((team, index) => (
            <div key={team.id} className="tile space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-xs text-muted-foreground"
                  title={index < 9 ? `Tast ${index + 1} gir poeng til dette laget` : undefined}
                >
                  Lag {index + 1}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums text-accent">
                    {team.score} p
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTeamToRemove(team.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    title={`Fjern ${team.name}`}
                    aria-label={`Fjern ${team.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor={`team-name-${team.id}`}>Lagnavn</Label>
                <Input
                  id={`team-name-${team.id}`}
                  value={team.name}
                  onChange={(e) => updateTeamName(team.id, e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label
                  htmlFor={`team-players-${team.id}`}
                  title="Komma mellom navn"
                >
                  Spillere
                </Label>
                <Input
                  id={`team-players-${team.id}`}
                  value={team.players.join(", ")}
                  onChange={(e) =>
                    updateTeamPlayers(
                      team.id,
                      e.target.value
                        .split(",")
                        .map((p) => p.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="Kari, Ola"
                  className="mt-1"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border pt-6">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              title="Setter poeng til 0 og gjør alle kort spillbare igjen. Pågående økt lagres i historikken."
            >
              <RotateCcw className="h-4 w-4" />
              Nullstill poeng og svar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Nullstille spillet?</AlertDialogTitle>
              <AlertDialogDescription>
                {totalScore !== 0
                  ? `Til sammen ${totalScore} poeng blir satt til 0. `
                  : ""}
                Alle spørsmål blir spillbare igjen. Kan ikke angres.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => resetGame()}
              >
                Nullstill
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <AlertDialog
        open={teamToRemove !== null}
        onOpenChange={(open) => !open && setTeamToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Fjerne «{teams.find((t) => t.id === teamToRemove)?.name}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Poengene til laget forsvinner fra stillingen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (teamToRemove) removeTeam(teamToRemove);
                setTeamToRemove(null);
              }}
            >
              Fjern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
