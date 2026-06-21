"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CategoryPicker } from "@/components/category-picker";
import { ImageField } from "@/components/image-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { blobToBase64, type ProcessedImage } from "@/lib/image/process";

export interface ItemFormValues {
  name: string;
  content: string;
  categories: string[];
  link: string;
}

const EMPTY: ItemFormValues = { name: "", content: "", categories: [], link: "" };

export interface ItemDialogProps {
  mode: "add" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: string[];
  initial?: ItemFormValues;
  /** Edit mode: proxy URL of the entry's current image, for re-cropping. */
  currentImageSrc?: string;
  /** Returns true on success (dialog then closes). */
  onSubmit: (values: ItemFormValues, image?: { base64: string; ext: string }) => Promise<boolean>;
}

export function ItemDialog({
  mode,
  open,
  onOpenChange,
  suggestions,
  initial,
  currentImageSrc,
  onSubmit,
}: ItemDialogProps) {
  const [values, setValues] = useState<ItemFormValues>(initial ?? EMPTY);
  const [processed, setProcessed] = useState<ProcessedImage | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset only on the closed->open transition, so re-renders (e.g. while typing,
  // when `initial` is recreated by the parent) don't wipe the form.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setValues(initial ?? EMPTY);
      setProcessed(null);
      setSubmitting(false);
    }
    wasOpen.current = open;
  }, [open, initial]);

  const nameOk = values.name.trim().length > 0;
  const imageOk = mode === "edit" || processed !== null;
  const canSubmit = nameOk && imageOk && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const image = processed
        ? { base64: await blobToBase64(processed.blob), ext: processed.ext }
        : undefined;
      const ok = await onSubmit(values, image);
      if (ok) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Neues Bild" : "Bild bearbeiten"}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Lade ein Foto hoch und beschreibe das Schmuckstück."
              : "Ändere Name, Beschreibung oder Kategorien."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ImageField
            currentSrc={mode === "edit" ? currentImageSrc : undefined}
            onChange={setProcessed}
            disabled={submitting}
          />
          {mode === "edit" && (
            <p className="text-xs text-muted-foreground">
              Tippe auf „Zuschneiden", um Ausschnitt, Zoom oder Drehung zu ändern, oder „Anderes
              Bild" für ein neues Foto.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              placeholder="z. B. Rankenring"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-content">Beschreibung</Label>
            <Textarea
              id="item-content"
              value={values.content}
              onChange={(e) => setValues((v) => ({ ...v, content: e.target.value }))}
              placeholder="z. B. 585/- Gelbgold"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Kategorien</Label>
            <CategoryPicker
              value={values.categories}
              onChange={(categories) => setValues((v) => ({ ...v, categories }))}
              suggestions={suggestions}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-link">Link (optional)</Label>
            <Input
              id="item-link"
              value={values.link}
              onChange={(e) => setValues((v) => ({ ...v, link: e.target.value }))}
              placeholder="leer lassen oder z. B. /blog/…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {mode === "add" ? "Hinzufügen" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
