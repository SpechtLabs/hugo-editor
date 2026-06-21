import type { NextRequest } from "next/server";
import { config, imagePrefixes } from "@/lib/config";
import { getGitHub } from "@/lib/github/client";
import { getRawImage } from "@/lib/github/gallery";
import { yamlImageToRepoPath } from "@/lib/portfolio/paths";

/**
 * Streams an image out of the private website repo using the signed-in user's
 * token. The query param `src` is a YAML image value (e.g. "/images/ring.webp");
 * we resolve it to a repo path and refuse anything outside the configured image
 * dir, so this can't be used to read arbitrary repo files.
 */
export async function GET(req: NextRequest) {
  const ctx = await getGitHub();
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const src = req.nextUrl.searchParams.get("src");
  if (!src) return new Response("Missing src", { status: 400 });

  const repoPath = yamlImageToRepoPath(src, imagePrefixes);
  const dir = config.imageDir.replace(/\/+$/, "");
  if (repoPath.includes("..") || !repoPath.startsWith(`${dir}/`)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const { bytes, contentType } = await getRawImage(ctx.octokit, ctx.repo, repoPath);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        // Filenames are unique per upload, so a given path's bytes don't change.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
