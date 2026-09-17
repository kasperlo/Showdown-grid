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
import { Download, FileUp, ClipboardPaste } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  parseBoardText,
  parseExportedBoard,
  serializeBoard,
} from "@/utils/board-import";

const PASTE_EXAMPLE = `Norsk historie\t100\tHvem var Norges første statsminister?\tFrederik Stang
Mat\t100\tHva heter Norges nasjonalrett?\tFårikål
Kode\t100\tHva printes?\t"object"\tconsole.log(typeof null)`;

/**
 * Bulk in and out. Filling a 25-cell board by hand is the slowest part of
 * making a quiz, and the questions usually already exist in a spreadsheet.
 */
export function BoardTransfer() {
  const categories = useGameStore((s) => s.categories);
  const setCategories = useGameStore((s) => s.setCategories);
  const quizTitle = useGameStore((s) => s.quizTitle);
  const quizDescription = useGameStore((s) => s.quizDescription);
  const quizTimeLimit = useGameStore((s) => s.quizTimeLimit);
  const jokerTimeLimit = useGameStore((s) => s.jokerTimeLimit);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [replaceMode, setReplaceMode] = useState<"replace" | "append">("replace");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = serializeBoard({
      version: 1,
      title: quizTitle,
      description: quizDescription,
      timeLimit: quizTimeLimit,
      jokerTimeLimit,
      categories,
    });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(quizTitle || "quiz")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const board = parseExportedBoard(text);
      if (!board.categories.length) {
        throw new Error("Fila inneholder ingen kategorier.");
      }
      setCategories(board.categories);
      toast({
        title: "Brett importert",
        description: `${board.categories.length} kategorier lastet inn.`,
      });
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

  const handlePaste = () => {
    const result = parseBoardText(pasteText);
    if (!result.categories.length) {
      toast({
        title: "Fant ingen spørsmål",
        description: result.errors[0] ?? "Sjekk formatet og prøv igjen.",
        variant: "destructive",
      });
      return;
    }

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
        ? `${result.errors.length} rader ble hoppet over.`
        : `${result.categories.length} kategorier.`,
    });
  };

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
                Én rad per spørsmål: kategori, poeng, spørsmål, svar og
                eventuelt kode. Tabulator, semikolon eller komma mellom
                kolonnene. Skriv \n i kodekolonnen der du vil ha linjeskift.
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
              <Button onClick={handlePaste} disabled={!pasteText.trim()}>
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
            if (file) void handleFile(file);
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
    </div>
  );
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
