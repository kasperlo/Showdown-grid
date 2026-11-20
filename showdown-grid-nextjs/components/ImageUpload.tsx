"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Trash2, Link as LinkIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  compressImage,
  MAX_UPLOAD_BYTES,
  UPLOAD_TYPES,
} from "@/utils/compress-image";

interface ImageUploadProps {
  value: string | undefined;
  onChange: (url: string) => void;
  label?: string;
}

export function ImageUpload({ value, onChange, label = "Bilde" }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Remembered per URL, so a broken link hides only its own preview.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      onChange(await uploadImage(file));
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(
        error instanceof Error ? error.message : "Opplastingen feilet."
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUrlChange = (url: string) => {
    onChange(url);
    setUploadError(null);
    setBrokenUrl(null);
  };

  const handleRemoveImage = () => {
    onChange("");
    setUploadError(null);
  };

  const previewBroken = Boolean(value) && value === brokenUrl;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-2" />
            Last opp
          </TabsTrigger>
          <TabsTrigger value="url">
            <LinkIcon className="h-4 w-4 mr-2" />
            URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept={UPLOAD_TYPES.join(",")}
              onChange={handleFileSelect}
              disabled={isUploading}
              className="cursor-pointer"
            />
            {isUploading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-2">
          <Input
            type="text"
            placeholder="https://example.com/image.jpg"
            value={value || ""}
            onChange={(e) => handleUrlChange(e.target.value)}
            title="Direkte lenke til et bilde"
          />
        </TabsContent>
      </Tabs>

      {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

      {value && (
        <div className="mt-2 relative">
          {previewBroken ? (
            <p className="rounded-lg border border-destructive/40 px-3 py-2 pr-9 text-sm text-destructive">
              Kunne ikke laste bildet. Sjekk lenken.
            </p>
          ) : (
            <img
              key={value}
              src={value}
              alt="Forhåndsvisning"
              className="rounded-lg max-h-32 w-full object-contain border bg-muted/30"
              onError={() => setBrokenUrl(value)}
            />
          )}
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={handleRemoveImage}
            title="Fjern bilde"
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

/** Compresses, checks the size and uploads. Throws with a message to show. */
async function uploadImage(file: File): Promise<string> {
  if (!UPLOAD_TYPES.includes(file.type)) {
    throw new Error("Ugyldig filtype. Kun JPEG, PNG, GIF og WebP er støttet.");
  }

  const prepared = await compressImage(file);
  if (prepared.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Bildet er for stort (${megabytes(prepared.size)} MB). Maks ${megabytes(MAX_UPLOAD_BYTES)} MB.`
    );
  }

  const formData = new FormData();
  formData.append("file", prepared);

  let response: Response;
  try {
    response = await fetch("/api/upload", { method: "POST", body: formData });
  } catch {
    throw new Error("Fikk ikke kontakt med serveren. Sjekk nettet og prøv igjen.");
  }

  if (!response.ok) throw new Error(await uploadErrorMessage(response));

  const data = await response.json().catch(() => null);
  if (typeof data?.url !== "string") {
    throw new Error("Opplastingen feilet. Prøv igjen.");
  }
  return data.url;
}

/**
 * Vercel answers a body over its limit with a 413 of its own, before the
 * route runs, so an error response is not always JSON.
 */
async function uploadErrorMessage(response: Response): Promise<string> {
  if (response.status === 413) {
    return `Bildet er for stort. Maks ${megabytes(MAX_UPLOAD_BYTES)} MB.`;
  }
  const body = await response.json().catch(() => null);
  return typeof body?.error === "string" && body.error
    ? body.error
    : `Opplastingen feilet (${response.status}). Prøv igjen.`;
}

function megabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toLocaleString("nb-NO", {
    maximumFractionDigits: 1,
  });
}
