import React, { useMemo, useState } from "react";
import { useGameStore } from "@/utils/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Undo2, Info } from "lucide-react";

export default function AdminAdjust() {
  const { teams, manualAdjustScore, adjustmentLog, undoLastAdjustment } = useGameStore();

  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  const [amountText, setAmountText] = useState<string>("100");
  const [reason, setReason] = useState<string>("");

  useMemo(() => {
    if (!teams.find((t) => t.id === teamId)) {
      setTeamId(teams[0]?.id ?? "");
    }
  }, [teams, teamId]);

  const amount = useMemo(() => {
    const n = Number.parseInt(amountText, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [amountText]);

  const canApply = teams.length > 0 && !!teamId && amount > 0;

  const apply = (sign: 1 | -1) => {
    if (!canApply) return;
    const delta = sign * amount;
    manualAdjustScore(teamId, delta, reason.trim() || undefined);
    setReason("");
  };

  return (
    <div className="mt-8 p-4 rounded-2xl glass">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-bold">Admin-justering</h3>
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          Manuell justering utenfor runde – loggføres
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="md:col-span-2">
          <Label htmlFor="admin-team">Lag</Label>
          <select
            id="admin-team"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-popover text-foreground p-2"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <Label htmlFor="admin-amount">Poeng</Label>
          <Input
            id="admin-amount"
            type="number"
            inputMode="numeric"
            min={0}
            step={50}
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="admin-reason">Begrunnelse (valgfritt)</Label>
          <Input
            id="admin-reason"
            type="text"
            placeholder="F.eks. regelavvik, teknisk feil, bonus"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          onClick={() => apply(-1)}
          disabled={!canApply}
          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        >
          − Trekk {amount} poeng
        </Button>
        <Button
          onClick={() => apply(1)}
          disabled={!canApply}
          className="bg-success hover:bg-success/90 text-success-foreground"
        >
          + Legg til {amount} poeng
        </Button>
        <Button
          onClick={undoLastAdjustment}
          variant="ghost"
          className="ml-auto"
          title="Angre siste manuelle justering"
        >
          <Undo2 className="h-4 w-4 mr-2" />
          Angre siste
        </Button>
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Siste justeringer</h4>
        {adjustmentLog.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen manuelle justeringer ennå.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {adjustmentLog.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-md border border-border bg-popover/60 backdrop-blur px-3 py-2">
                <span className="truncate">
                  <span className={e.delta >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                    {e.delta >= 0 ? `+${e.delta}` : `${e.delta}`}
                  </span>{" "}
                  til <span className="font-medium">{e.teamNameSnapshot}</span>
                  {e.reason ? <span className="text-muted-foreground"> — {e.reason}</span> : null}
                </span>
                <time className="text-muted-foreground ml-3 whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleTimeString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}