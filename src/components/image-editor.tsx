"use client";

import { Loader2, RotateCcw, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cropAndEncode,
  type ProcessedImage,
  toWorkingImage,
  type WorkingImage,
} from "@/lib/image/process";

const ASPECTS: { label: string; value: number | "original" }[] = [
  { label: "Original", value: "original" },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:4", value: 3 / 4 },
];

export interface ImageEditorProps {
  open: boolean;
  /** A picked File, or a same-origin URL of an existing image. */
  source: File | string | null;
  onApply: (result: ProcessedImage) => void;
  onCancel: () => void;
}

/** Touch-first crop / zoom / rotate (pinch + drag work on iPhone/iPad). */
export function ImageEditor({ open, source, onApply, onCancel }: ImageEditorProps) {
  const [working, setWorking] = useState<WorkingImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspectChoice, setAspectChoice] = useState<number | "original">("original");
  const [naturalAspect, setNaturalAspect] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);

  useEffect(() => {
    if (!open || !source) return;
    let cancelled = false;
    let createdUrl: string | null = null;

    setLoading(true);
    setError(null);
    setWorking(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspectChoice("original");
    setAreaPixels(null);

    toWorkingImage(source)
      .then((w) => {
        if (cancelled) {
          URL.revokeObjectURL(w.url);
          return;
        }
        createdUrl = w.url;
        setNaturalAspect(w.canvas.width / w.canvas.height);
        setWorking(w);
      })
      .catch((e) =>
        cancelled
          ? undefined
          : setError(e instanceof Error ? e.message : "Bild konnte nicht geladen werden"),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, source]);

  const aspect = aspectChoice === "original" ? naturalAspect : aspectChoice;

  async function handleApply() {
    if (!working || !areaPixels) return;
    setApplying(true);
    try {
      onApply(await cropAndEncode(working.canvas, areaPixels, rotation));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bild konnte nicht verarbeitet werden");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[95dvh] gap-3 overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bild zuschneiden</DialogTitle>
        </DialogHeader>

        <div className="relative h-[50dvh] w-full overflow-hidden rounded-lg bg-black">
          {working && (
            <Cropper
              image={working.url}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              minZoom={1}
              maxZoom={4}
              showGrid
              restrictPosition
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={(_area, pixels) => setAreaPixels(pixels)}
            />
          )}
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 className="size-7 animate-spin" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ASPECTS.map((a) => (
            <Button
              key={a.label}
              type="button"
              size="sm"
              variant={aspectChoice === a.value ? "default" : "outline"}
              onClick={() => setAspectChoice(a.value)}
            >
              {a.label}
            </Button>
          ))}
        </div>

        <label className="flex items-center gap-3 text-sm">
          <span className="w-14 text-muted-foreground">Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-2 flex-1 accent-primary"
            aria-label="Zoom"
          />
        </label>

        <div className="flex items-center gap-3 text-sm">
          <span className="w-14 text-muted-foreground">Drehen</span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
            aria-label="Nach links drehen"
          >
            <RotateCcw className="size-4" />
          </Button>
          <input
            type="range"
            min={0}
            max={359}
            step={1}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="h-2 flex-1 accent-primary"
            aria-label="Drehung"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            aria-label="Nach rechts drehen"
          >
            <RotateCw className="size-4" />
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={applying}>
            Abbrechen
          </Button>
          <Button onClick={handleApply} disabled={!working || !areaPixels || applying}>
            {applying && <Loader2 className="size-4 animate-spin" />}
            Übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
