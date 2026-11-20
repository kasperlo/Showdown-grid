"use client";

import { useRef, useState } from "react";
import { useGameStore } from "@/utils/store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, FileUp, ClipboardPaste } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  parseBoardText,
  parseExportedBoard,
  serializeBoard,
  type ExportedTeam,
  type ImportedBoard,
  type ImportResult,
} from "@/utils/board-import";
import { countQuestions, extractTemplate } from "@/utils/quiz-template";
import type { Category } from "@/utils/types";

const PASTE_EXAMPLE = `Norsk historie\t100\tHvem var Norges første statsminister?\tFrederik Stang
Mat\t100\tHva heter Norges nasjonalrett?\tFårikål
Kode\t100\tHva printes?\t"object"\tconsole.log(typeof null)\tEn gammel feil i JavaScript`;

/**
 * Bulk in and out. Filling a 25-cell board by hand is the slowest part of
 * making a quiz, and the questions usually already exist in a spreadsheet.
 */
export function BoardTransfer() {
  const categories = useGameStore((s) => s.categories);
  const setCategories = useGameStore((s) => s.setCategories);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [replaceMode, setReplaceMode] = useState<"replace" | "append">("replace");
  const [pendingPaste, setPendingPaste] = useState<ImportResult | null>(null);
  const [pendingFile, setPendingFile] = useState<{
    name: string;
    board: ImportedBoard;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const template = extractTemplate(useGameStore.getState());
    const json = serializeBoard({
      version: 1,
      title: template.quizTitle,
      description: template.quizDescription,
      timeLimit: template.quizTimeLimit,
      jokerTimeLimit: template.jokerTimeLimit,
      theme: template.quizTheme,
      turnRule: template.turnRule,
      teams: template.teams.map(({ name, players }) => ({ name, players })),
      categories: template.categories,
    });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(template.quizTitle || "quiz")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const readFile = async (file: File) => {
    try {
      const board = parseExportedBoard(await file.text());
      if (!board.categories.length) {
        throw new Error("Fila inneholder ingen kategorier.");
      }
      setPendingFile({ name: file.name, board });
    } catch (error) {
      toast({
        title: "Kunne ikke lese fila",
        description:
          error instanceof Error ? error.message : "Ukjent format",
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const applyFile = (board: ImportedBoard) => {
    const store = useGameStore.getState();
    store.setCategories(board.categories);
    if (board.title !== undefined) store.setQuizTitle(board.title);
    if (board.description !== undefined) store.setQuizDescription(board.description);
    if (board.timeLimit !== undefined) store.setQuizTimeLimit(board.timeLimit);
    if (board.jokerTimeLimit !== undefined) {
      store.setJokerTimeLimit(board.jokerTimeLimit);
    }
    if (board.theme !== undefined) store.setQuizTheme(board.theme);
    if (board.turnRule !== undefined) store.setTurnRule(board.turnRule);
    if (board.teams !== undefined) replaceTeams(board.teams);
    toast({
      title: "Brett importert",
      description: `${count(board.categories.length, "kategori", "kategorier")} og ${countQuestions(board.categories)} kort lastet inn.`,
    });
  };

  const readPaste = () => {
    const result = parseBoardText(pasteText);
    if (!result.categories.length) {
      toast({
        title: "Fant ingen spørsmål",
        description: result.errors[0] ?? "Sjekk formatet og prøv igjen.",
        variant: "destructive",
      });
      return;
    }
    if (replaceMode === "replace" && categories.length > 0) {
      setPendingPaste(result);
      return;
    }
    applyPaste(result);
  };

  const applyPaste = (result: ImportResult) => {
    setCategories(
      replaceMode === "replace"
        ? result.categories
        : [...categories, ...result.categories]
    );
    setPasteOpen(false);
    setPasteText("");
    toast({
      title: `${result.rowCount} spørsmål lagt inn`,
      description: result.errors.length
        ? `${count(result.errors.length, "rad", "rader")} ble hoppet over.`
        : `${count(result.categories.length, "kategori", "kategorier")}.`,
    });
  };

  const fileSettings = pendingFile ? importedSettings(pendingFile.board) : [];

  return (
    <div className="space-y-3">
      <Label
        className="text-base font-semibold"
        title="Lim inn fra regneark, eller ta en sikkerhetskopi av brettet"
      >
        Importer og eksporter
      </Label>

      <div className="flex flex-wrap gap-2">
        <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <ClipboardPaste className="h-4 w-4" />
              Lim inn spørsmål
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Lim inn spørsmål</DialogTitle>
              <DialogDescription>
                Én rad per spørsmål med kolonnene kategori, poeng, spørsmål,
                svar, kode og «Tilleggsinfo». Kode og tilleggsinfo kan utelates;
                tilleggsinfo vises under svaret. Tabulator, semikolon eller komma
                mellom kolonnene. Skriv \n der du vil ha linjeskift i kode eller
                tilleggsinfo.
              </DialogDescription>
            </DialogHeader>

            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={PASTE_EXAMPLE}
              rows={10}
              className="font-mono text-xs"
            />

            <div className="flex items-center gap-2 text-sm">
              <Button
                type="button"
                size="sm"
                variant={replaceMode === "replace" ? "default" : "outline"}
                onClick={() => setReplaceMode("replace")}
              >
                Erstatt brettet
              </Button>
              <Button
                type="button"
                size="sm"
                variant={replaceMode === "append" ? "default" : "outline"}
                onClick={() => setReplaceMode("append")}
              >
                Legg til
              </Button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPasteOpen(false)}>
                Avbryt
              </Button>
              <Button onClick={readPaste} disabled={!pasteText.trim()}>
                Les inn
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp className="h-4 w-4" />
          Importer JSON
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readFile(file);
          }}
        />

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleExport}
          disabled={!categories.length}
        >
          <Download className="h-4 w-4" />
          Eksporter JSON
        </Button>
      </div>

      <AlertDialog
        open={!!pendingPaste}
        onOpenChange={(open) => !open && setPendingPaste(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erstatte hele brettet?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPaste &&
                replacementSummary(
                  categories.length,
                  pendingPaste.categories,
                  "det du limte inn"
                )}{" "}
              Kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const result = pendingPaste;
                setPendingPaste(null);
                if (result) applyPaste(result);
              }}
            >
              Erstatt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingFile}
        onOpenChange={(open) => !open && setPendingFile(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erstatte hele brettet?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingFile &&
                replacementSummary(
                  categories.length,
                  pendingFile.board.categories,
                  `«${pendingFile.name}»`
                )}{" "}
              {fileSettings.length > 0 &&
                `Fila endrer også ${joinNorwegian(fileSettings)}. `}
              Kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const file = pendingFile;
                setPendingFile(null);
                if (file) applyFile(file.board);
              }}
            >
              Erstatt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Gives the board the file's teams through the store's own team actions, so
 * the saved game state follows along. Teams already on the board are renamed
 * in place and keep their ids and scores.
 */
function replaceTeams(teams: ExportedTeam[]) {
  const store = useGameStore.getState();
  const current = store.teams;
  teams.forEach((team, index) => {
    const existing = current[index];
    if (existing) {
      store.updateTeamName(existing.id, team.name);
      store.updateTeamPlayers(existing.id, team.players);
      return;
    }
    store.addTeam(team.name);
    const now = useGameStore.getState().teams;
    store.updateTeamPlayers(now[now.length - 1].id, team.players);
  });
  current.slice(teams.length).forEach((team) => store.removeTeam(team.id));
}

/** The quiz settings a file will change, in words. */
function importedSettings(board: ImportedBoard): string[] {
  const settings: string[] = [];
  if (board.title !== undefined) settings.push("tittel");
  if (board.description !== undefined) settings.push("beskrivelse");
  if (board.timeLimit !== undefined) settings.push("tid per spørsmål");
  if (board.jokerTimeLimit !== undefined) settings.push("standard joker-tid");
  if (board.turnRule !== undefined) settings.push("hvem som velger neste kort");
  if (board.theme !== undefined) settings.push("tema");
  if (board.teams !== undefined) settings.push("lagene");
  return settings;
}

function replacementSummary(
  current: number,
  incoming: Category[],
  source: string
): string {
  const what = `${count(incoming.length, "kategori", "kategorier")}, ${countQuestions(incoming)} kort fra ${source}`;
  return current > 0
    ? `${count(current, "eksisterende kategori", "eksisterende kategorier")} forsvinner og erstattes av ${what}.`
    : `Brettet får ${what}.`;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function joinNorwegian(items: string[]): string {
  return items.length > 1
    ? `${items.slice(0, -1).join(", ")} og ${items[items.length - 1]}`
    : items.join("");
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[æ]/g, "ae")
      .replace(/[ø]/g, "o")
      .replace(/[å]/g, "a")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "quiz"
  );
}
