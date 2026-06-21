import { heicTo, isHeic } from "heic-to/next";

/**
 * Client-side image preparation: decode (including iPhone HEIC), respect EXIF
 * orientation, downscale, and re-encode as .webp — matching the site's existing
 * convention and keeping committed files small (~150-400 KB) so they fit a single
 * Server Action body and a single git blob.
 */

export interface ProcessedImage {
  /** The re-encoded image (webp where supported, otherwise jpeg). */
  blob: Blob;
  /** File extension matching `blob` ("webp" or "jpg"). */
  ext: string;
  /** Object URL for previewing in an <img>. Revoke when done. */
  previewUrl: string;
  width: number;
  height: number;
  bytes: number;
}

export interface ProcessOptions {
  /** Longest-edge cap in pixels. Default 1600. */
  maxEdge?: number;
  /** webp quality 0–1. Default 0.82. */
  quality?: number;
}

export async function processImage(file: File, opts: ProcessOptions = {}): Promise<ProcessedImage> {
  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.82;

  const bitmap = await decodeToBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable in this browser");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const { blob, ext } = await encodeBest(canvas, quality);
  return { blob, ext, previewUrl: URL.createObjectURL(blob), width, height, bytes: blob.size };
}

async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  if (await isHeicSafe(file)) {
    return heicTo({ blob: file, type: "bitmap", options: { imageOrientation: "from-image" } });
  }
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

async function isHeicSafe(file: Blob): Promise<boolean> {
  try {
    return await isHeic(file as File);
  } catch {
    return false;
  }
}

function fitWithin(w: number, h: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / longest;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Encode as webp when the browser supports it, otherwise jpeg. iOS Safari before
 * 17 silently ignores `image/webp` and hands back a (much larger) PNG, so we check
 * the produced blob's type and fall back to jpeg — important since this runs mostly
 * on iPhones/iPads.
 */
async function encodeBest(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<{ blob: Blob; ext: string }> {
  const webp = await canvasToBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };

  const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
  if (jpeg && jpeg.type === "image/jpeg") return { blob: jpeg, ext: "jpg" };

  // Last resort: whatever the first attempt produced (e.g. a PNG fallback).
  if (webp) return { blob: webp, ext: webp.type === "image/png" ? "png" : "webp" };
  throw new Error("Bild konnte nicht kodiert werden");
}

/** Raw base64 (no data: prefix) for sending to a Server Action. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── crop / rotate ────────────────────────────────────────────────────────────

export interface CropPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorkingImage {
  /** Downscaled canvas used as both the cropper's source and the crop input. */
  canvas: HTMLCanvasElement;
  /** Object URL for the cropper to display (revoke when done). */
  url: string;
}

/** Decode a File / Blob / same-origin URL into an upright ImageBitmap. */
export async function loadBitmap(source: File | Blob | string): Promise<ImageBitmap> {
  let blob: Blob;
  if (typeof source === "string") {
    const res = await fetch(source);
    if (!res.ok) throw new Error("Bild konnte nicht geladen werden");
    blob = await res.blob();
  } else {
    blob = source;
  }
  if (await isHeicSafe(blob)) {
    return heicTo({ blob, type: "bitmap", options: { imageOrientation: "from-image" } });
  }
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

/**
 * Prepare a source for the cropper: downscale into a canvas (so even a huge phone
 * photo stays smooth to pan/zoom) and produce a display URL. Crop coordinates from
 * the cropper then map 1:1 onto this canvas.
 */
export async function toWorkingImage(source: File | Blob | string): Promise<WorkingImage> {
  const bitmap = await loadBitmap(source);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, 2400);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable in this browser");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
  return { canvas, url: URL.createObjectURL(blob ?? new Blob()) };
}

/**
 * Apply the cropper's selection + rotation, then downscale and encode. Mirrors the
 * canonical react-easy-crop pipeline: rotate the source into its bounding box, then
 * lift out the selected rectangle.
 */
export async function cropAndEncode(
  source: HTMLCanvasElement | ImageBitmap,
  crop: CropPixels,
  rotation: number,
  opts: ProcessOptions = {},
): Promise<ProcessedImage> {
  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.82;
  const sw = source.width;
  const sh = source.height;
  const rad = (rotation * Math.PI) / 180;
  const boxW = Math.round(Math.abs(Math.cos(rad) * sw) + Math.abs(Math.sin(rad) * sh));
  const boxH = Math.round(Math.abs(Math.sin(rad) * sw) + Math.abs(Math.cos(rad) * sh));

  const rotated = document.createElement("canvas");
  rotated.width = boxW;
  rotated.height = boxH;
  const rctx = rotated.getContext("2d");
  if (!rctx) throw new Error("Canvas 2D context is unavailable in this browser");
  rctx.translate(boxW / 2, boxH / 2);
  rctx.rotate(rad);
  rctx.drawImage(source, -sw / 2, -sh / 2);

  const { width, height } = fitWithin(crop.width, crop.height, maxEdge);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(width));
  out.height = Math.max(1, Math.round(height));
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas 2D context is unavailable in this browser");
  octx.drawImage(rotated, crop.x, crop.y, crop.width, crop.height, 0, 0, out.width, out.height);

  const { blob, ext } = await encodeBest(out, quality);
  return {
    blob,
    ext,
    previewUrl: URL.createObjectURL(blob),
    width: out.width,
    height: out.height,
    bytes: blob.size,
  };
}
