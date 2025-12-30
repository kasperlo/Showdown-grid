"use client";

import { useState, useMemo } from "react";
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

interface TeamAdjustmentModalProps {
  team: Team | null;
  onClose: () => void;
}

export function TeamAdjustmentModal({ team, onClose }: TeamAdjustmentModalProps) {
  const [pointsText, setPointsText] = useState<string>("100");
  const [reason, setReason] = useState("");
  const manualAdjustScore = useGameStore((state) => state.manualAdjustScore);

  const points = useMemo(() => {
    const n = Number.parseInt(pointsText, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [pointsText]);

  if (!team) return null;

  const handleAdjust = (delta: number) => {
    manualAdjustScore(team.id, delta, reason || undefined);
    setPointsText("100");
    setReason("");
    onClose();
  };

  return (
    <Dialog open={!!team} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Juster poeng for {team.name}</DialogTitle>
          <DialogDescription>
            Legg til eller trekk fra poeng manuelt
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="points">Poeng</Label>
            <Input
              id="points"
              type="number"
              inputMode="numeric"
              value={pointsText}
              onChange={(e) => setPointsText(e.target.value)}
              min={0}
              step={50}
            />
          </div>

          <div>
            <Label htmlFor="reason">Grunn (valgfri)</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="F.eks. bonus for kreativitet"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button
            variant="destructive"
            onClick={() => handleAdjust(-points)}
            className="w-full sm:w-auto"
          >
            − Trekk {points} poeng
          </Button>
          <Button
            variant="default"
            onClick={() => handleAdjust(points)}
            className="w-full sm:w-auto"
          >
            + Legg til {points} poeng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
