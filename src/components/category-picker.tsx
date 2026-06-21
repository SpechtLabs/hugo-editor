"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface CategoryPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
}

/** Toggle existing categories or type a new one. Friendlier than a combobox. */
export function CategoryPicker({ value, onChange, suggestions }: CategoryPickerProps) {
  const [draft, setDraft] = useState("");

  function add(category: string) {
    const c = category.trim();
    if (!c || value.includes(c)) return;
    onChange([...value, c]);
    setDraft("");
  }

  const available = suggestions.filter((s) => !value.includes(s));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((category) => (
            <Badge key={category} variant="secondary" className="gap-1 pr-1">
              {category}
              <button
                type="button"
                onClick={() => onChange(value.filter((c) => c !== category))}
                aria-label={`${category} entfernen`}
                className="rounded-full p-0.5 hover:bg-foreground/15"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder="Kategorie hinzufügen…"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => add(draft)}
          aria-label="Kategorie hinzufügen"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => add(suggestion)}>
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                + {suggestion}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
