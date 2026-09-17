"use client";

import { useMemo, useState } from "react";
import { useGameStore } from "@/utils/store";
import type { Team } from "@/utils/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hand, Trash2 } from "lucide-react";

interface TeamAdjustmentModalProps {
  team: Team | null;
  onClose: () => void;
}

export function TeamAdjustmentModal({
  team,
  onClose,
}: TeamAdjustmentModalProps) {
  if (!team) return null;
  // Keyed per team so the name field and the amount reset by remounting rather
  // than by an effect that has to undo the previous team's values.
  return <AdjustmentBody key={team.id} team={team} onClose={onClose} />;
}

function AdjustmentBody({
  team,
  onClose,
}: {
  team: Team;
  onClose: () => void;
}) {
  const manualAdjustScore = useGameStore((state) => state.manualAdjustScore);
  const updateTeamName = useGameStore((state) => state.updateTeamName);
  const removeTeam = useGameStore((state) => state.removeTeam);
  const setCurrentTurn = useGameStore((state) => state.setCurrentTurn);
  const currentTurnTeamId = useGameStore((state) => state.currentTurnTeamId);

  const [pointsText, setPointsText] = useState("100");
  const [reason, setReason] = useState("");
  const [name, setName] = useState(team.name);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const points = useMemo(() => {
    const n = Number.parseInt(pointsText, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [pointsText]);

  const commitName = () => {
    const next = name.trim();
    if (next && next !== team.name) updateTeamName(team.id, next);
  };

  const handleAdjust = (delta: number) => {
    commitName();
    manualAdjustScore(team.id, delta, reason || undefined);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Endre lagnavn, juster poeng manuelt, eller fjern laget.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {team.id !== currentTurnTeamId && (
            /* The host needs to be able to say who picks next without waiting
               for the rotation to come round — a team swaps a player, someone
               passes, a card is voided. */
            <Button
              variant="secondary"
              className="w-full gap-2"
              onClick={() => {
                commitName();
                setCurrentTurn(team.id);
                onClose();
              }}
            >
              <Hand className="h-4 w-4" />
              Gi turen til {team.name}
            </Button>
          )}

          <div>
            <Label htmlFor="team-name">Lagnavn</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={commitName}
              maxLength={80}
            />
          </div>

          <div>
            <Label htmlFor="points">Poeng</Label>
            <Input
              id="points"
              type="number"
              inputMode="numeric"
              value={pointsText}
              onChange={(event) => setPointsText(event.target.value)}
              min={0}
              step={50}
            />
          </div>

          <div>
            <Label htmlFor="reason">Grunn (valgfri)</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="F.eks. bonus for kreativitet"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {confirmingRemove ? (
            <Button
              variant="destructive"
              className="w-full gap-2 sm:mr-auto sm:w-auto"
              onClick={() => {
                removeTeam(team.id);
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Fjern {team.name} for godt
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="w-full gap-2 sm:mr-auto sm:w-auto"
              onClick={() => setConfirmingRemove(true)}
              title="Fjerner laget og poengsummen dets"
            >
              <Trash2 className="h-4 w-4" />
              Fjern laget
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => handleAdjust(-points)}
            className="w-full sm:w-auto"
          >
            − {points}
          </Button>
          <Button
            onClick={() => handleAdjust(points)}
            className="w-full sm:w-auto"
          >
            + {points}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
