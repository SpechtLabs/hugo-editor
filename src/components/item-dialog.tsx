"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CategoryPicker } from "@/components/category-picker";
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
import { UploadDropzone } from "@/components/upload-dropzone";
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
  /** Returns true on success (dialog then closes). */
  onSubmit: (values: ItemFormValues, imageBase64?: string) => Promise<boolean>;
}

export function ItemDialog({
  mode,
  open,
  onOpenChange,
  suggestions,
  initial,
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
      const imageBase64 = processed ? await blobToBase64(processed.blob) : undefined;
      const ok = await onSubmit(values, imageBase64);
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
          {mode === "add" && <UploadDropzone onChange={setProcessed} disabled={submitting} />}

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
