"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PortfolioItem } from "@/lib/portfolio/schema";
import { cn } from "@/lib/utils";

export interface GalleryCardProps {
  uid: string;
  item: PortfolioItem;
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function GalleryCard({ uid, item, disabled, onEdit, onDelete }: GalleryCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: uid,
    disabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const src = `/api/image?src=${encodeURIComponent(item.image)}`;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative gap-0 overflow-hidden p-0",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
    >
      <div className="relative aspect-square bg-muted">
        {/* biome-ignore lint/performance/noImgElement: served via our auth proxy, not optimizable by next/image. */}
        <img src={src} alt={item.name} loading="lazy" className="h-full w-full object-cover" />

        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Verschieben"
          className="absolute top-2 left-2 cursor-grab touch-none rounded-md bg-background/80 p-1.5 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing max-sm:opacity-100"
        >
          <GripVertical className="size-4" />
        </button>

        <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-8"
            onClick={onEdit}
            disabled={disabled}
            aria-label="Bearbeiten"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-8"
            onClick={onDelete}
            disabled={disabled}
            aria-label="Löschen"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1 p-3">
        <p className="truncate text-sm font-medium" title={item.name}>
          {item.name}
        </p>
        {item.content && <p className="truncate text-xs text-muted-foreground">{item.content}</p>}
        {item.categories.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {item.categories.map((category) => (
              <Badge key={category} variant="outline" className="text-[10px]">
                {category}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
