"use client";

import { useState } from "react";
import { useGameStore } from "@/utils/store";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CheckCircle2, ListChecks, Settings2, Users } from "lucide-react";
import { SaveIndicator } from "@/components/SaveIndicator";
import { EditModeToggle } from "@/components/editor/EditModeToggle";
import { TeamsEditor } from "@/components/editor/TeamsEditor";
import { QuizSettings } from "@/components/editor/QuizSettings";
import { readiness } from "@/utils/card-status";

/**
 * The one row of controls above the board. Play/edit, whether the quiz is ready,
 * and the two things that are not the board itself — teams and rules — behind
 * sheets so they stop competing with the content.
 */
export function EditorBar() {
  const editMode = useGameStore((s) => s.editMode);
  const categories = useGameStore((s) => s.categories);
  const startQueue = useGameStore((s) => s.startQueue);
  const canEdit = useGameStore((s) => s.canEditActiveQuiz());
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  if (!canEdit) return null;

  const { missing } = readiness(categories);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <EditModeToggle />

      {editMode && <SaveIndicator className="hidden sm:inline-flex" />}

      <div className="ml-auto flex items-center gap-2">
        {editMode &&
          (missing > 0 ? (
            <Button
              size="sm"
              className="h-8 gap-1.5 rounded-full bg-accent text-xs font-bold text-accent-foreground hover:bg-accent/90"
              onClick={() => startQueue("incomplete")}
              title="Gå gjennom kortene som mangler noe"
            >
              <ListChecks className="h-3.5 w-3.5" />
              {missing} {missing === 1 ? "mangel" : "mangler"}
            </Button>
          ) : (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-success/50 bg-success/[0.14] px-3 text-xs font-bold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Klar
            </span>
          ))}

        {editMode && (
          <Sheet open={teamsOpen} onOpenChange={setTeamsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-full text-xs"
                title="Lag og spillere"
              >
                <Users className="h-3.5 w-3.5" />
                Lag
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>Lag</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <TeamsEditor />
              </div>
            </SheetContent>
          </Sheet>
        )}

        {editMode && (
          <Sheet open={rulesOpen} onOpenChange={setRulesOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-full text-xs"
                title="Tid, tema, deling, import og eksport"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Regler
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>Regler</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <QuizSettings />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}
