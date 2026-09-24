import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { MAX_BYTES, MAX_UPLOAD_PARTS, UPLOAD_CHUNK_BYTES, UPLOAD_TYPES, type MediaType } from "@/lib/uploads";

const STORAGE_BUCKET = "post-images";
const UPLOAD_PREFIX = "uploads";
// Outside UPLOAD_PREFIX so a half-finished part can never be attached to a post.
const PARTS_PREFIX = "upload-parts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/*
 * Files travel browser -> this app -> Supabase in chunks, instead of the
 * browser uploading to Supabase directly. The direct upload failed with a
 * network error for the owner (the browser never got a usable response from
 * Supabase Storage), and routing through our own origin removes CORS and
 * signed-URL issues entirely. Chunks keep every request under Vercel's
 * ~4.5 MB function body limit; the last step stitches them together.
 */

export class UploadError extends Error {}

function bucket() {
  return supabaseAdmin().storage.from(STORAGE_BUCKET);
}

function partPath(uploadId: string, index: number) {
  return `${PARTS_PREFIX}/${uploadId}/${String(index).padStart(3, "0")}`;
}

function assertUploadId(uploadId: string) {
  if (!UUID_RE.test(uploadId)) throw new UploadError("Invalid upload id.");
}

export function startUpload(): { uploadId: string; chunkSize: number } {
  return { uploadId: randomUUID(), chunkSize: UPLOAD_CHUNK_BYTES };
}

export async function storeUploadPart(uploadId: string, index: number, bytes: Uint8Array): Promise<void> {
  assertUploadId(uploadId);
  if (!Number.isInteger(index) || index < 0 || index >= MAX_UPLOAD_PARTS) {
    throw new UploadError("Invalid chunk index.");
  }
  if (bytes.byteLength === 0 || bytes.byteLength > UPLOAD_CHUNK_BYTES) {
    throw new UploadError("Invalid chunk size.");
  }

  const { error } = await bucket().upload(partPath(uploadId, index), bytes, {
    contentType: "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(`Could not store the upload: ${error.message}`);
}

export async function completeUpload(
  uploadId: string,
  contentType: string,
  parts: number
): Promise<{ publicUrl: string; mediaType: MediaType }> {
  assertUploadId(uploadId);
  const info = UPLOAD_TYPES[contentType];
  if (!info) throw new UploadError("Unsupported file type.");
  if (!Number.isInteger(parts) || parts < 1 || parts > MAX_UPLOAD_PARTS) {
    throw new UploadError("Invalid number of chunks.");
  }

  const store = bucket();
  const paths = Array.from({ length: parts }, (_, i) => partPath(uploadId, i));

  const chunks = await Promise.all(
    paths.map(async (p) => {
      const { data, error } = await store.download(p);
      if (error || !data) throw new UploadError("Part of the upload is missing. Please try again.");
      return new Uint8Array(await data.arrayBuffer());
    })
  );

  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  if (total > MAX_BYTES[info.kind]) {
    await store.remove(paths);
    throw new UploadError("The file is larger than allowed.");
  }

  const file = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    file.set(c, offset);
    offset += c.byteLength;
  }

  const finalPath = `${UPLOAD_PREFIX}/${new Date().toISOString().slice(0, 10)}/${uploadId}.${info.ext}`;
  const { error } = await store.upload(finalPath, file, { contentType, upsert: false });
  await store.remove(paths);
  if (error) {
    throw new Error(
      /exceeded|too large|size/i.test(error.message)
        ? "Your Supabase storage rejected this file as too large. Raise the upload size limit in Supabase Storage settings or pick a smaller file."
        : `Could not save the upload: ${error.message}`
    );
  }

  return { publicUrl: store.getPublicUrl(finalPath).data.publicUrl, mediaType: info.kind };
}

/** Only media uploaded through completeUpload may be attached to a post. */
export function isOwnUploadUrl(url: string): boolean {
  const prefix = bucket().getPublicUrl(`${UPLOAD_PREFIX}/`).data.publicUrl;
  return url.startsWith(prefix) && !url.includes("..");
}
