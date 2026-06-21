import { heicTo, isHeic } from "heic-to/next";

/**
 * Client-side image preparation: decode (including iPhone HEIC), respect EXIF
 * orientation, downscale, and re-encode as .webp — matching the site's existing
 * convention and keeping committed files small (~150-400 KB) so they fit a single
 * Server Action body and a single git blob.
 */

export interface ProcessedImage {
  /** The re-encoded webp. */
  blob: Blob;
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

  const blob = await canvasToWebp(canvas, quality);
  return { blob, previewUrl: URL.createObjectURL(blob), width, height, bytes: blob.size };
}

async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  if (await isHeicSafe(file)) {
    return heicTo({ blob: file, type: "bitmap", options: { imageOrientation: "from-image" } });
  }
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

async function isHeicSafe(file: File): Promise<boolean> {
  try {
    return await isHeic(file);
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

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("webp encoding failed"))),
      "image/webp",
      quality,
    );
  });
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
