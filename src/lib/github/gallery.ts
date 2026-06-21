import "server-only";
import type { Octokit } from "@octokit/rest";
import { config } from "@/lib/config";
import type { PortfolioItem } from "@/lib/portfolio/schema";
import { readItems } from "@/lib/portfolio/yaml";

interface RepoRef {
  owner: string;
  name: string;
  branch: string;
}

export interface GalleryFile {
  /** Raw YAML text of the data file. */
  text: string;
  /** Blob sha of the data file (handy for cache keys / debugging). */
  sha: string;
}

export interface Gallery extends GalleryFile {
  items: PortfolioItem[];
}

/** Fetch and decode the gallery data file. */
export async function getGalleryFile(octokit: Octokit, repo: RepoRef): Promise<GalleryFile> {
  const res = await octokit.repos.getContent({
    owner: repo.owner,
    repo: repo.name,
    path: config.galleryDataPath,
    ref: repo.branch,
  });
  const data = res.data;
  if (Array.isArray(data) || data.type !== "file") {
    throw new Error(`${config.galleryDataPath} is not a file`);
  }
  const text = Buffer.from(data.content, data.encoding as BufferEncoding).toString("utf-8");
  return { text, sha: data.sha };
}

/** Fetch the gallery file and parse it into display-ordered entries. */
export async function getGallery(octokit: Octokit, repo: RepoRef): Promise<Gallery> {
  const file = await getGalleryFile(octokit, repo);
  return { ...file, items: readItems(file.text, config.galleryItemsKeyPath) };
}

const CONTENT_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
};

export function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export interface RawImage {
  bytes: Buffer;
  contentType: string;
}

/**
 * Read an image file's bytes from the (private) repo. Uses getContent for the blob
 * sha, then the Blob API — which returns full base64 for any size, unlike getContent
 * which truncates files over ~1 MB.
 */
export async function getRawImage(
  octokit: Octokit,
  repo: RepoRef,
  repoPath: string,
): Promise<RawImage> {
  const meta = await octokit.repos.getContent({
    owner: repo.owner,
    repo: repo.name,
    path: repoPath,
    ref: repo.branch,
  });
  if (Array.isArray(meta.data) || meta.data.type !== "file") {
    throw new Error(`${repoPath} is not a file`);
  }

  let base64 = meta.data.content;
  if (!base64 || meta.data.encoding !== "base64") {
    const blob = await octokit.git.getBlob({
      owner: repo.owner,
      repo: repo.name,
      file_sha: meta.data.sha,
    });
    base64 = blob.data.content;
  }

  return {
    bytes: Buffer.from(base64, "base64"),
    contentType: contentTypeFor(repoPath),
  };
}
