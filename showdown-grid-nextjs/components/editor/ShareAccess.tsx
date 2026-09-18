"use client";

import { useState } from "react";
import { useGameStore } from "@/utils/store";
import { useShareStatus } from "@/hooks/queries/useQuizzes";
import {
  useEnableSharing,
  useDisableSharing,
  useRemoveCollaborator,
} from "@/hooks/mutations/useQuizMutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Check, Copy, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * Owner-only. A collaborator who joined through the link gets full edit
 * rights on the board, but never sees this panel — only the owner can turn
 * the link on/off or remove someone (enforced server-side too, this is just
 * where the control lives).
 */
export function ShareAccess() {
  const activeQuizId = useGameStore((s) => s.activeQuizId);
  const { data, isLoading } = useShareStatus(activeQuizId);
  const enableSharing = useEnableSharing();
  const disableSharing = useDisableSharing();
  const removeCollaborator = useRemoveCollaborator();
  const [copied, setCopied] = useState(false);

  if (!activeQuizId) return null;

  const shareToken = data?.shareToken ?? null;
  const shareUrl =
    typeof window !== "undefined" && shareToken
      ? `${window.location.origin}/join/${shareToken}`
      : "";

  const handleToggle = async (checked: boolean) => {
    try {
      if (checked) {
        await enableSharing.mutateAsync(activeQuizId);
      } else {
        await disableSharing.mutateAsync(activeQuizId);
      }
    } catch {
      toast({
        title: checked ? "Kunne ikke aktivere deling" : "Kunne ikke slå av deling",
        variant: "destructive",
      });
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRemove = async (userId: string, email: string) => {
    try {
      await removeCollaborator.mutateAsync({ quizId: activeQuizId, userId });
      toast({ title: "Fjernet", description: email });
    } catch {
      toast({ title: "Kunne ikke fjerne redaktøren", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Label
          className="text-base font-semibold"
          title="Alle som åpner lenken og logger inn får full redigeringstilgang"
        >
          Del redigeringstilgang
        </Label>
        <Switch
          checked={Boolean(shareToken)}
          onCheckedChange={handleToggle}
          disabled={isLoading || enableSharing.isPending || disableSharing.isPending}
          aria-label="Slå delingslenke av eller på"
        />
      </div>

      {shareToken && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={shareUrl} readOnly className="flex-1" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Kopiert" : "Kopier"}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {data?.collaborators.length
                ? "Har redigeringstilgang:"
                : "Ingen har blitt med enda."}
            </p>
            {data?.collaborators.map((collaborator) => (
              <div
                key={collaborator.userId}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="truncate">{collaborator.email}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={() => handleRemove(collaborator.userId, collaborator.email)}
                  title="Fjern"
                  aria-label={`Fjern ${collaborator.email}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
