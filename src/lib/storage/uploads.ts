import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { UPLOAD_TYPES, type MediaType } from "@/lib/uploads";

const STORAGE_BUCKET = "post-images";
const UPLOAD_PREFIX = "uploads";

/**
 * A one-time URL the browser uploads the file to directly. Sending the bytes
 * through this app's API instead would hit Vercel's ~4.5 MB request body
 * limit, which almost every video exceeds.
 */
export async function createUploadTarget(
  contentType: string
): Promise<{ signedUrl: string; publicUrl: string; mediaType: MediaType }> {
  const info = UPLOAD_TYPES[contentType];
  if (!info) throw new Error("Unsupported file type.");

  const path = `${UPLOAD_PREFIX}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${info.ext}`;
  const bucket = supabaseAdmin().storage.from(STORAGE_BUCKET);

  const { data, error } = await bucket.createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Could not prepare the upload: ${error?.message ?? "unknown error"}`);

  return {
    signedUrl: data.signedUrl,
    publicUrl: bucket.getPublicUrl(path).data.publicUrl,
    mediaType: info.kind,
  };
}

/** Only media uploaded through createUploadTarget may be attached to a post. */
export function isOwnUploadUrl(url: string): boolean {
  const prefix = supabaseAdmin().storage.from(STORAGE_BUCKET).getPublicUrl(`${UPLOAD_PREFIX}/`).data.publicUrl;
  return url.startsWith(prefix) && !url.includes("..");
}
