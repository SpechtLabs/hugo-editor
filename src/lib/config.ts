import "server-only";

/**
 * Server-side configuration, driven entirely by environment variables so the
 * editor can be pointed at any Hugo site whose gallery is a YAML array of items.
 * Defaults target the GoldSpecht jewelry site.
 */

function env(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.length > 0 ? value : fallback;
}

const galleryItemsPath = env("GALLERY_ITEMS_PATH", "portfolio.portfolio_item");

export const config = {
  repo: {
    owner: env("GITHUB_REPO_OWNER", "SpechtLabs"),
    name: env("GITHUB_REPO_NAME", "GoldSpecht"),
    branch: env("GITHUB_REPO_BRANCH", "main"),
  },
  /** Public URL of the live website (for the "view site" link). */
  siteUrl: env("SITE_URL", "https://gold-specht.de"),
  /** Path, within the repo, of the Hugo data file holding the gallery. */
  galleryDataPath: env("GALLERY_DATA_PATH", "data/de/portfolio.yml"),
  /** Dotted key path to the item array inside that YAML document. */
  galleryItemsPath,
  galleryItemsKeyPath: galleryItemsPath.split("."),
  /** On-disk image folder in the repo and the URL prefix Hugo serves it under. */
  imageDir: env("IMAGE_DIR", "static/images"),
  imagePublicPrefix: env("IMAGE_PUBLIC_PREFIX", "/images"),
  /** GitHub logins permitted to sign in. */
  allowedLogins: env("ALLOWED_GITHUB_LOGINS", "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
} as const;

export type AppConfig = typeof config;

/** Convenience bundle of the two image-path prefixes for the pure path helpers. */
export const imagePrefixes = {
  imageDir: config.imageDir,
  imagePublicPrefix: config.imagePublicPrefix,
};
