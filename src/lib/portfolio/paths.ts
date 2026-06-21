/**
 * Pure helpers mapping between the three ways an image is referred to:
 *
 *   YAML value   e.g. "/images/ring.webp" or "images/galerie/ring.webp"
 *   repo path    e.g. "static/images/ring.webp"        (where the file lives)
 *   public URL   e.g. "/images/ring.webp"              (how Hugo serves it)
 *
 * No environment access here so it stays trivially testable; callers pass the
 * two configured prefixes (imageDir, imagePublicPrefix).
 */

export interface ImagePrefixes {
  /** On-disk folder in the repo, e.g. "static/images". */
  imageDir: string;
  /** URL prefix Hugo serves it under, e.g. "/images". */
  imagePublicPrefix: string;
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

/** Normalize a YAML image value to a leading-slash public URL path. */
export function yamlImageToPublicUrl(image: string): string {
  const trimmed = image.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * Resolve a YAML image value to its path inside the repo. Anything under the
 * public prefix maps into the image dir; anything else is treated as a repo-root
 * relative static path (Hugo serves `static/` at the site root).
 */
export function yamlImageToRepoPath(image: string, prefixes: ImagePrefixes): string {
  const url = yamlImageToPublicUrl(image);
  const prefix = stripTrailingSlash(prefixes.imagePublicPrefix);
  const dir = stripTrailingSlash(prefixes.imageDir);
  if (url === prefix || url.startsWith(`${prefix}/`)) {
    return `${dir}${url.slice(prefix.length)}`;
  }
  // Fallback: other static asset, lives under static/ at the same path.
  return `static${url}`;
}

/** Inverse of {@link yamlImageToRepoPath}: repo path -> YAML image value. */
export function repoPathToYamlImage(repoPath: string, prefixes: ImagePrefixes): string {
  const dir = stripTrailingSlash(prefixes.imageDir);
  const prefix = stripTrailingSlash(prefixes.imagePublicPrefix);
  if (repoPath === dir || repoPath.startsWith(`${dir}/`)) {
    return `${prefix}${repoPath.slice(dir.length)}`;
  }
  if (repoPath.startsWith("static/")) {
    return repoPath.slice("static".length);
  }
  return `/${repoPath}`;
}

/** Filesystem-safe slug for use in image filenames. */
export function slugify(name: string): string {
  const map: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };
  return (
    name
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => map[c] ?? c)
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "image"
  );
}

export interface NewImagePaths {
  filename: string;
  repoPath: string;
  yamlImage: string;
}

/**
 * Build paths for a freshly uploaded image. `id` is a short unique token the
 * caller supplies (e.g. crypto.randomUUID().slice(0, 8)) so filenames don't
 * collide; passed in rather than generated here to keep this deterministic.
 */
export function newImagePaths(
  name: string,
  id: string,
  prefixes: ImagePrefixes,
  ext = "webp",
): NewImagePaths {
  const filename = `${slugify(name)}-${id}.${ext}`;
  const dir = stripTrailingSlash(prefixes.imageDir);
  const prefix = stripTrailingSlash(prefixes.imagePublicPrefix);
  return {
    filename,
    repoPath: `${dir}/${filename}`,
    yamlImage: `${prefix}/${filename}`,
  };
}
