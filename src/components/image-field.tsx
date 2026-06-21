"use client";

import { Crop, ImagePlus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ImageEditor } from "@/components/image-editor";
import { Button } from "@/components/ui/button";
import { formatBytes, type ProcessedImage } from "@/lib/image/process";

export interface ImageFieldProps {
  /** Existing image URL (edit mode), shown until the user changes it. */
  currentSrc?: string;
  /** Fires whenever a new/edited image is produced (null = unchanged). */
  onChange: (processed: ProcessedImage | null) => void;
  disabled?: boolean;
}

/** Pick a photo (or reuse an existing one), then crop/zoom/rotate it. */
export function ImageField({ currentSrc, onChange, disabled }: ImageFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editorSource, setEditorSource] = useState<File | string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [processed, setProcessed] = useState<ProcessedImage | null>(null);

  useEffect(() => {
    return () => {
      if (processed) URL.revokeObjectURL(processed.previewUrl);
    };
  }, [processed]);

  function pickFile(file: File | undefined) {
    if (!file || disabled) return;
    setEditorSource(file);
    setEditorOpen(true);
  }

  function openEditor() {
    if (disabled) return;
    if (!editorSource && currentSrc) setEditorSource(currentSrc);
    if (editorSource || currentSrc) setEditorOpen(true);
  }

  function handleApply(result: ProcessedImage) {
    setProcessed((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return result;
    });
    onChange(result);
    setEditorOpen(false);
  }

  const previewUrl = processed?.previewUrl ?? currentSrc ?? null;

  return (
    <div className="space-y-2">
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30">
        {previewUrl ? (
          // biome-ignore lint/performance/noImgElement: object URL / auth-proxied image.
          <img src={previewUrl} alt="Vorschau" className="h-full w-full object-contain" />
        ) : (
          <label
            htmlFor={inputId}
            className="flex cursor-pointer flex-col items-center gap-2 p-6 text-muted-foreground"
          >
            <ImagePlus className="size-7" />
            <span className="text-sm">Foto auswählen</span>
          </label>
        )}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {processed
            ? `${processed.width}×${processed.height} · ${formatBytes(processed.bytes)}`
            : "JPG, PNG, HEIC"}
        </span>
        <div className="flex gap-1">
          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={openEditor}
            >
              <Crop className="size-3.5" />
              Zuschneiden
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {previewUrl ? "Anderes Bild" : "Auswählen"}
          </Button>
        </div>
      </div>

      <ImageEditor
        open={editorOpen}
        source={editorSource}
        onApply={handleApply}
        onCancel={() => setEditorOpen(false)}
      />
    </div>
  );
}
