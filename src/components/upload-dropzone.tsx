"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatBytes, type ProcessedImage, processImage } from "@/lib/image/process";
import { cn } from "@/lib/utils";

export interface UploadDropzoneProps {
  onChange: (result: ProcessedImage | null) => void;
  disabled?: boolean;
}

/** Pick or drop a photo; decode (incl. HEIC) + downscale + webp-encode in-browser. */
export function UploadDropzone({ onChange, disabled }: UploadDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<ProcessedImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.previewUrl);
    };
  }, [preview]);

  async function handleFile(file: File | undefined) {
    if (!file || disabled) return;
    setError(null);
    setProcessing(true);
    try {
      const result = await processImage(file);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return result;
      });
      onChange(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bild konnte nicht verarbeitet werden");
      onChange(null);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-2">
      {/** biome-ignore lint/a11y/noStaticElementInteractions: drop target; keyboard access is via the labeled file input below. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30 text-center transition-colors",
          dragOver && "border-primary bg-accent",
          disabled && "opacity-60",
        )}
      >
        {preview ? (
          // biome-ignore lint/performance/noImgElement: local object URL, not a remote asset.
          <img src={preview.previewUrl} alt="Vorschau" className="h-full w-full object-contain" />
        ) : (
          <label
            htmlFor={inputId}
            className="flex cursor-pointer flex-col items-center gap-2 p-6 text-muted-foreground"
          >
            {processing ? (
              <Loader2 className="size-7 animate-spin" />
            ) : (
              <ImagePlus className="size-7" />
            )}
            <span className="text-sm">
              {processing ? "Bild wird verarbeitet…" : "Foto hierher ziehen oder klicken"}
            </span>
          </label>
        )}
        {processing && preview && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="size-7 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="sr-only"
        disabled={disabled || processing}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {preview
            ? `${preview.width}×${preview.height} · ${formatBytes(preview.bytes)}`
            : "JPG, PNG, HEIC"}
        </span>
        {preview && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || processing}
            onClick={() => inputRef.current?.click()}
          >
            Anderes Bild
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
