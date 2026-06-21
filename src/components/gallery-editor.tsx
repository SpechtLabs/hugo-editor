"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { ExternalLink, ImagePlus, LogOut } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DeleteDialog } from "@/components/delete-dialog";
import { GalleryCard } from "@/components/gallery-card";
import { ItemDialog, type ItemFormValues } from "@/components/item-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import type { PortfolioItem } from "@/lib/portfolio/schema";
import { collectCategories } from "@/lib/portfolio/transform";
import {
  type ActionResult,
  addGalleryItem,
  deleteGalleryItem,
  reorderGallery,
  updateGalleryItem,
} from "@/server/actions";
import { signOutAction } from "@/server/auth-actions";

interface Row {
  uid: string;
  item: PortfolioItem;
}

const PUBLISH_NOTE = "Wird in ein bis zwei Minuten veröffentlicht.";

function toRows(items: PortfolioItem[]): Row[] {
  return items.map((item) => ({ uid: crypto.randomUUID(), item }));
}

export interface GalleryEditorProps {
  initialItems: PortfolioItem[];
  login?: string;
  liveUrl: string;
}

export function GalleryEditor({ initialItems, login, liveUrl }: GalleryEditorProps) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initialItems));
  const [pending, setPending] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editUid, setEditUid] = useState<string | null>(null);
  const [deleteUid, setDeleteUid] = useState<string | null>(null);

  const busy = pending > 0;
  const suggestions = useMemo(() => collectCategories(rows.map((r) => r.item)), [rows]);

  const editRow = rows.find((r) => r.uid === editUid) ?? null;
  const deleteRow = rows.find((r) => r.uid === deleteUid) ?? null;
  const editInitial: ItemFormValues | undefined = editRow
    ? {
        name: editRow.item.name,
        content: editRow.item.content,
        categories: editRow.item.categories,
        link: editRow.item.link,
      }
    : undefined;

  // Serialize commits: each action reads the file fresh server-side, so they must
  // not overlap. Chaining keeps them strictly one-at-a-time.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = queue.current.then(fn, fn) as Promise<T>;
    queue.current = next.catch(() => undefined);
    return next;
  }

  async function runAction(
    fn: () => Promise<ActionResult>,
    opts: { success: string; onSuccess?: (items: PortfolioItem[]) => void; onError?: () => void },
  ): Promise<ActionResult> {
    setPending((p) => p + 1);
    try {
      const result = await enqueue(fn);
      if (result.ok) {
        opts.onSuccess?.(result.items);
        toast.success(opts.success, { description: PUBLISH_NOTE });
      } else {
        opts.onError?.();
        toast.error("Fehler", { description: result.error });
      }
      return result;
    } finally {
      setPending((p) => p - 1);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const prev = rows;
    const from = prev.findIndex((r) => r.uid === active.id);
    const to = prev.findIndex((r) => r.uid === over.id);
    if (from < 0 || to < 0) return;

    const next = arrayMove(prev, from, to);
    setRows(next); // optimistic
    const order = next.map((r) => prev.findIndex((p) => p.uid === r.uid));
    void runAction(() => reorderGallery({ order }), {
      success: "Reihenfolge gespeichert",
      onError: () => setRows(prev),
    });
  }

  async function handleAdd(values: ItemFormValues, imageBase64?: string): Promise<boolean> {
    if (!imageBase64) {
      toast.error("Kein Bild ausgewählt");
      return false;
    }
    const result = await runAction(
      () => addGalleryItem({ ...values, imageBase64, position: "start" }),
      { success: `„${values.name}" hinzugefügt`, onSuccess: (items) => setRows(toRows(items)) },
    );
    return result.ok;
  }

  async function handleEdit(values: ItemFormValues): Promise<boolean> {
    if (!editRow) return false;
    const prev = rows;
    const index = prev.findIndex((r) => r.uid === editRow.uid);
    const { image } = editRow.item;
    setRows(
      prev.map((r) => (r.uid === editRow.uid ? { ...r, item: { ...r.item, ...values } } : r)),
    );
    const result = await runAction(
      () => updateGalleryItem({ index, expectImage: image, ...values }),
      {
        success: "Änderungen gespeichert",
        onSuccess: (items) => setRows(toRows(items)),
        onError: () => setRows(prev),
      },
    );
    return result.ok;
  }

  function handleDelete() {
    if (!deleteRow) return;
    const prev = rows;
    const index = prev.findIndex((r) => r.uid === deleteRow.uid);
    const { image } = deleteRow.item;
    setRows(prev.filter((r) => r.uid !== deleteRow.uid)); // optimistic
    setDeleteUid(null);
    void runAction(() => deleteGalleryItem({ index, expectImage: image }), {
      success: "Bild gelöscht",
      onSuccess: (items) => setRows(toRows(items)),
      onError: () => setRows(prev),
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Galerie</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "Bild" : "Bilder"}
            {login ? ` · angemeldet als ${login}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={liveUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLink className="size-4" />
            <span className="max-sm:sr-only">Website ansehen</span>
          </a>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="size-4" />
              <span className="max-sm:sr-only">Abmelden</span>
            </Button>
          </form>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <ImagePlus className="size-4" />
            Bild hinzufügen
          </Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <ImagePlus className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Noch keine Bilder in der Galerie.</p>
          <Button onClick={() => setAddOpen(true)}>Erstes Bild hinzufügen</Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((r) => r.uid)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {rows.map((row) => (
                <GalleryCard
                  key={row.uid}
                  uid={row.uid}
                  item={row.item}
                  disabled={busy}
                  onEdit={() => setEditUid(row.uid)}
                  onDelete={() => setDeleteUid(row.uid)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <ItemDialog
        mode="add"
        open={addOpen}
        onOpenChange={setAddOpen}
        suggestions={suggestions}
        onSubmit={handleAdd}
      />

      <ItemDialog
        mode="edit"
        open={editUid !== null}
        onOpenChange={(open) => !open && setEditUid(null)}
        suggestions={suggestions}
        initial={editInitial}
        onSubmit={handleEdit}
      />

      <DeleteDialog
        open={deleteUid !== null}
        onOpenChange={(open) => !open && setDeleteUid(null)}
        itemName={deleteRow?.item.name}
        onConfirm={handleDelete}
      />
    </div>
  );
}
