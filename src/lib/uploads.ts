/**
 * Media the owner can upload for a manual post. Shared by the browser (to
 * reject a file before uploading it) and the server (which is the real gate).
 *
 * Limits follow what Facebook accepts by URL and what Supabase's free tier
 * allows per object (50 MB).
 */

export type MediaType = "image" | "video";

export const UPLOAD_TYPES: Record<string, { kind: MediaType; ext: string }> = {
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/png": { kind: "image", ext: "png" },
  "image/gif": { kind: "image", ext: "gif" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/quicktime": { kind: "video", ext: "mov" },
};

export const MAX_BYTES: Record<MediaType, number> = {
  image: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
};

export const MAX_CAPTION_LENGTH = 5000;

export const UPLOAD_ACCEPT = Object.keys(UPLOAD_TYPES).join(",");

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Why a file cannot be uploaded, or null when it can. */
export function validateUpload(type: string, size: number): string | null {
  const info = UPLOAD_TYPES[type];
  if (!info) return "Only JPG, PNG, GIF images or MP4/MOV videos can be uploaded.";
  if (size > MAX_BYTES[info.kind]) {
    return `${info.kind === "image" ? "Images" : "Videos"} can be at most ${formatBytes(MAX_BYTES[info.kind])}.`;
  }
  return null;
}
