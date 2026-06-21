import { type Document, isMap, isSeq, parseDocument, type YAMLMap, type YAMLSeq } from "yaml";
import { type ItemPatch, type NewItem, type PortfolioItem, PortfolioItemSchema } from "./schema";

/**
 * Text-in / text-out mutations of the Hugo gallery data file.
 *
 * Everything goes through the `yaml` Document API rather than parse->JS->stringify
 * so untouched entries keep their exact formatting and comments — commits stay to
 * a minimal, reviewable diff. Display order is array order, so a reorder is just a
 * reorder of the sequence's nodes.
 *
 * Entries are addressed by their **array index**, not by image path: the real data
 * can contain the same image referenced by two entries, so image is not a unique
 * key. Mutations take an optional `expectImage` guard to catch a stale index (the
 * file changed under us) and fail loudly instead of editing the wrong entry.
 */

export const DEFAULT_ITEMS_PATH = ["portfolio", "portfolio_item"] as const;

type ItemsPath = readonly (string | number)[];

function itemsSeq(doc: Document, itemsPath: ItemsPath): YAMLSeq {
  const node = doc.getIn(itemsPath, true);
  if (!isSeq(node)) {
    throw new Error(`gallery items not found at "${itemsPath.join(".")}" in the data file`);
  }
  return node;
}

function imageOf(node: unknown): string {
  if (!isMap(node)) return "";
  const value = (node as YAMLMap).get("image");
  if (typeof value === "string") return value;
  return value == null ? "" : String(value);
}

function nodeAt(seq: YAMLSeq, index: number): YAMLMap {
  if (!Number.isInteger(index) || index < 0 || index >= seq.items.length) {
    throw new Error(`gallery index ${index} out of range (0..${seq.items.length - 1})`);
  }
  return seq.items[index] as YAMLMap;
}

function assertExpectedImage(node: YAMLMap, expectImage: string | undefined): void {
  if (expectImage !== undefined && imageOf(node) !== expectImage) {
    throw new Error(
      `stale edit: expected image "${expectImage}" at this position but found ` +
        `"${imageOf(node)}". The gallery changed — reload and try again.`,
    );
  }
}

/** Parse the data file into validated, plain-JS gallery entries (display order). */
export function readItems(
  text: string,
  itemsPath: ItemsPath = DEFAULT_ITEMS_PATH,
): PortfolioItem[] {
  const doc = parseDocument(text);
  const seq = itemsSeq(doc, itemsPath);
  return seq.items.map((node) => PortfolioItemSchema.parse((node as YAMLMap).toJSON()));
}

/**
 * Reorder entries. `order` is a permutation of the current indices: `order[newPos]`
 * is the old index that should land at `newPos`. Rejected unless it's a complete,
 * duplicate-free permutation, so a reorder can never add or drop an entry.
 */
export function reorderItems(
  text: string,
  order: number[],
  itemsPath: ItemsPath = DEFAULT_ITEMS_PATH,
): string {
  const doc = parseDocument(text);
  const seq = itemsSeq(doc, itemsPath);
  const n = seq.items.length;
  if (order.length !== n) {
    throw new Error(`reorder expects ${n} indices, got ${order.length}`);
  }
  const seen = new Set<number>();
  for (const i of order) {
    if (!Number.isInteger(i) || i < 0 || i >= n || seen.has(i)) {
      throw new Error("reorder order must be a permutation of 0..n-1");
    }
    seen.add(i);
  }
  seq.items = order.map((i) => seq.items[i]);
  return String(doc);
}

function itemToPlain(item: NewItem) {
  return {
    name: item.name,
    image: item.image,
    categories: item.categories,
    content: item.content,
    link: item.link,
  };
}

/** Insert a new entry (defaults to the top of the gallery so it's easy to find). */
export function addItem(
  text: string,
  item: NewItem,
  opts: { position?: "start" | "end"; itemsPath?: ItemsPath } = {},
): string {
  const doc = parseDocument(text);
  const seq = itemsSeq(doc, opts.itemsPath ?? DEFAULT_ITEMS_PATH);
  const node = doc.createNode(itemToPlain(item));
  if ((opts.position ?? "start") === "start") {
    seq.items.unshift(node);
  } else {
    seq.add(node);
  }
  return String(doc);
}

/** Patch a single entry's editable fields by index. `rotate: null` removes the key. */
export function updateItemAt(
  text: string,
  index: number,
  patch: ItemPatch,
  opts: { expectImage?: string; itemsPath?: ItemsPath } = {},
): string {
  const doc = parseDocument(text);
  const seq = itemsSeq(doc, opts.itemsPath ?? DEFAULT_ITEMS_PATH);
  const node = nodeAt(seq, index);
  assertExpectedImage(node, opts.expectImage);

  if (patch.name !== undefined) node.set("name", patch.name);
  if (patch.content !== undefined) node.set("content", patch.content);
  if (patch.link !== undefined) node.set("link", patch.link);
  if (patch.image !== undefined) node.set("image", patch.image);
  if (patch.categories !== undefined) node.set("categories", doc.createNode(patch.categories));
  if (patch.rotate !== undefined) {
    if (patch.rotate === null) node.delete("rotate");
    else node.set("rotate", patch.rotate);
  }
  return String(doc);
}

/** Remove the entry at `index`. */
export function removeItemAt(
  text: string,
  index: number,
  opts: { expectImage?: string; itemsPath?: ItemsPath } = {},
): string {
  const doc = parseDocument(text);
  const seq = itemsSeq(doc, opts.itemsPath ?? DEFAULT_ITEMS_PATH);
  const node = nodeAt(seq, index);
  assertExpectedImage(node, opts.expectImage);
  seq.items.splice(index, 1);
  return String(doc);
}
