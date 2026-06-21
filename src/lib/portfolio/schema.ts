import { z } from "zod";

/**
 * One gallery entry as stored in the Hugo data file. `.loose()` keeps any
 * unknown keys intact so we never drop fields we don't model (the YAML
 * Document API preserves them on write regardless, but this keeps reads honest).
 */
export const PortfolioItemSchema = z
  .object({
    name: z.string().default(""),
    image: z.string(),
    categories: z.array(z.string()).default([]),
    content: z.string().default(""),
    link: z.string().default(""),
    rotate: z.number().optional(),
  })
  .loose();

export type PortfolioItem = z.infer<typeof PortfolioItemSchema>;

/** Fields the editor lets a user set when creating or editing an entry. */
export const ItemFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  content: z.string().trim(),
  categories: z.array(z.string().trim().min(1)),
  link: z.string().trim(),
});

export type ItemForm = z.infer<typeof ItemFormSchema>;

/** A patch applied to an existing entry. `rotate: null` deletes the key. */
export type ItemPatch = Partial<{
  name: string;
  content: string;
  categories: string[];
  link: string;
  image: string;
  rotate: number | null;
}>;

/** A fully-formed new entry, including the image path it was just uploaded to. */
export type NewItem = ItemForm & { image: string };

/**
 * An entry paired with the data needed to mutate it safely: its current array
 * index, plus its image as a staleness guard. (Image is NOT unique — the real
 * data references one photo from two entries — so the index is the real address.)
 */
export interface IndexedItem {
  index: number;
  image: string;
  item: PortfolioItem;
}
