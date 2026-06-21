"use server";

import { revalidatePath } from "next/cache";
import { config, imagePrefixes } from "@/lib/config";
import { requireGitHub } from "@/lib/github/client";
import { commitChanges, type FileChange } from "@/lib/github/commit";
import { getGalleryFile } from "@/lib/github/gallery";
import { newImagePaths, yamlImageToRepoPath } from "@/lib/portfolio/paths";
import { ItemFormSchema, type PortfolioItem } from "@/lib/portfolio/schema";
import {
  addItem,
  readItems,
  removeItemAt,
  reorderItems as reorderText,
  updateItemAt,
} from "@/lib/portfolio/yaml";

/**
 * One server action per user action; each makes a single atomic commit to the
 * website repo and returns the fresh gallery so the client can reconcile its
 * optimistic state. Errors come back as data (not thrown) so the UI can show them.
 */

export type ActionResult =
  | { ok: true; items: PortfolioItem[]; commitUrl?: string }
  | { ok: false; error: string };

function itemsFrom(text: string): PortfolioItem[] {
  return readItems(text, config.galleryItemsKeyPath);
}

function shortId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function fail(err: unknown): { ok: false; error: string } {
  return { ok: false, error: err instanceof Error ? err.message : "Etwas ist schiefgelaufen" };
}

export interface AddInput {
  name: string;
  content: string;
  categories: string[];
  link: string;
  imageBase64: string;
  position?: "start" | "end";
}

export async function addGalleryItem(input: AddInput): Promise<ActionResult> {
  try {
    if (!input.imageBase64) return { ok: false, error: "Kein Bild ausgewählt" };
    const form = ItemFormSchema.parse(input);

    const { octokit, repo } = await requireGitHub();
    const { text } = await getGalleryFile(octokit, repo);

    const { repoPath, yamlImage } = newImagePaths(form.name, shortId(), imagePrefixes);
    const newText = addItem(
      text,
      { ...form, image: yamlImage },
      { position: input.position ?? "start", itemsPath: config.galleryItemsKeyPath },
    );

    const changes: FileChange[] = [
      { path: repoPath, content: input.imageBase64, encoding: "base64" },
      { path: config.galleryDataPath, content: newText, encoding: "utf-8" },
    ];
    const res = await commitChanges(octokit, repo, `gallery: add "${form.name}"`, changes);
    revalidatePath("/");
    return { ok: true, items: itemsFrom(newText), commitUrl: res.commitUrl };
  } catch (err) {
    return fail(err);
  }
}

export interface UpdateInput {
  index: number;
  expectImage: string;
  name: string;
  content: string;
  categories: string[];
  link: string;
}

export async function updateGalleryItem(input: UpdateInput): Promise<ActionResult> {
  try {
    const form = ItemFormSchema.parse(input);
    const { octokit, repo } = await requireGitHub();
    const { text } = await getGalleryFile(octokit, repo);

    const newText = updateItemAt(
      text,
      input.index,
      { name: form.name, content: form.content, categories: form.categories, link: form.link },
      { expectImage: input.expectImage, itemsPath: config.galleryItemsKeyPath },
    );
    const res = await commitChanges(octokit, repo, `gallery: edit "${form.name}"`, [
      { path: config.galleryDataPath, content: newText, encoding: "utf-8" },
    ]);
    revalidatePath("/");
    return { ok: true, items: itemsFrom(newText), commitUrl: res.commitUrl };
  } catch (err) {
    return fail(err);
  }
}

export async function reorderGallery(input: { order: number[] }): Promise<ActionResult> {
  try {
    const { octokit, repo } = await requireGitHub();
    const { text } = await getGalleryFile(octokit, repo);

    const newText = reorderText(text, input.order, config.galleryItemsKeyPath);
    if (newText === text) return { ok: true, items: itemsFrom(text) };

    const res = await commitChanges(octokit, repo, "gallery: reorder items", [
      { path: config.galleryDataPath, content: newText, encoding: "utf-8" },
    ]);
    revalidatePath("/");
    return { ok: true, items: itemsFrom(newText), commitUrl: res.commitUrl };
  } catch (err) {
    return fail(err);
  }
}

export interface DeleteInput {
  index: number;
  expectImage: string;
  deleteFile?: boolean;
}

export async function deleteGalleryItem(input: DeleteInput): Promise<ActionResult> {
  try {
    const { octokit, repo } = await requireGitHub();
    const { text } = await getGalleryFile(octokit, repo);

    const current = itemsFrom(text);
    const target = current[input.index];
    if (!target) return { ok: false, error: "Eintrag nicht gefunden" };
    const name = target.name || "Bild";

    const newText = removeItemAt(text, input.index, {
      expectImage: input.expectImage,
      itemsPath: config.galleryItemsKeyPath,
    });

    const changes: FileChange[] = [
      { path: config.galleryDataPath, content: newText, encoding: "utf-8" },
    ];
    // Remove the image file too, but only if no remaining entry still references it.
    if (input.deleteFile !== false) {
      const stillUsed = itemsFrom(newText).some((it) => it.image === target.image);
      const repoPath = yamlImageToRepoPath(target.image, imagePrefixes);
      const dir = config.imageDir.replace(/\/+$/, "");
      if (!stillUsed && repoPath.startsWith(`${dir}/`)) {
        changes.push({ path: repoPath, delete: true });
      }
    }
    const res = await commitChanges(octokit, repo, `gallery: remove "${name}"`, changes);
    revalidatePath("/");
    return { ok: true, items: itemsFrom(newText), commitUrl: res.commitUrl };
  } catch (err) {
    return fail(err);
  }
}
