"use client";

import { useEffect, useState } from "react";
import {
  FloppyDisk,
  Rocket,
  CalendarPlus,
  WarningCircle,
  CheckCircle,
  ArrowSquareOut,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MediaDropzone, type SelectedMedia } from "@/components/upload/media-dropzone";
import { facebookPostUrl } from "@/lib/types";
import type { PageCache } from "@/lib/types";
import { MAX_CAPTION_LENGTH, UPLOAD_TYPES, validateUpload } from "@/lib/uploads";

type Action = "draft" | "schedule" | "post_now";

/** XHR rather than fetch so the upload can report progress. */
function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}). The file may be too large for your storage plan.`));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(form);
  });
}

export default function UploadPage() {
  const [media, setMedia] = useState<SelectedMedia | null>(null);
  const [caption, setCaption] = useState("");
  const [pages, setPages] = useState<PageCache[]>([]);
  const [pageId, setPageId] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  const [saving, setSaving] = useState<Action | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/facebook/pages")
      .then((r) => r.json())
      .then((d) => {
        setPages(d.pages ?? []);
        if (d.defaultPageId) setPageId(d.defaultPageId);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (media) URL.revokeObjectURL(media.previewUrl);
    };
  }, [media]);

  function selectFile(file: File) {
    const invalid = validateUpload(file.type, file.size);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSuccess(null);
    setPublishedUrl(null);
    setMedia({ file, previewUrl: URL.createObjectURL(file), mediaType: UPLOAD_TYPES[file.type].kind });
  }

  async function submit(action: Action) {
    if (!media) {
      setError("Choose a photo or video first.");
      return;
    }
    if (action !== "draft" && !pageId) {
      setError("Choose a Page before scheduling or posting.");
      return;
    }
    if (action === "schedule" && !scheduledAt) {
      setError("Pick a date and time to schedule this post.");
      return;
    }

    const page = pages.find((p) => p.page_id === pageId);
    setError(null);
    setSuccess(null);
    setPublishedUrl(null);
    setSaving(action);

    try {
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: media.file.type, size: media.file.size }),
      });
      const target = await signRes.json();
      if (!signRes.ok) throw new Error(target.error ?? "Could not prepare the upload.");

      setProgress(0);
      await uploadWithProgress(target.signedUrl, media.file, setProgress);
      setProgress(null);

      const res = await fetch("/api/posts/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl: target.publicUrl,
          mediaType: media.mediaType,
          caption,
          pageId: pageId || "unset",
          pageName: page?.name ?? "Unset",
          action,
          scheduledAt: action === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save post.");
      if (action === "post_now" && data.post.status === "failed") {
        throw new Error(data.post.error_message ?? "Facebook rejected this post.");
      }

      setSuccess(
        action === "draft"
          ? "Saved as a draft. Find it in the Queue."
          : action === "schedule"
            ? "Post scheduled."
            : media.mediaType === "video"
              ? "Video sent to Facebook. It may take a few minutes to finish processing."
              : "Published to Facebook."
      );
      if (action === "post_now" && data.post.facebook_post_id) {
        setPublishedUrl(facebookPostUrl(data.post.facebook_post_id));
      }
      setMedia(null);
      setCaption("");
      setScheduleOpen(false);
      setScheduledAt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(null);
      setProgress(null);
    }
  }

  const busy = saving !== null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
          <WarningCircle size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3.5 text-sm text-success">
          <CheckCircle size={18} className="shrink-0" />
          {success}
          {publishedUrl && (
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              View post <ArrowSquareOut size={13} />
            </a>
          )}
        </div>
      )}

      <Card>
        <div className="grid gap-6 md:grid-cols-[320px_1fr]">
          <MediaDropzone
            media={media}
            onSelect={selectFile}
            onClear={() => setMedia(null)}
            disabled={busy}
            progress={progress}
          />

          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="caption" className="text-sm font-semibold text-foreground">
                Description
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Write the caption for your post. Add hashtags and links right here.
              </p>
              <textarea
                id="caption"
                value={caption}
                maxLength={MAX_CAPTION_LENGTH}
                rows={8}
                disabled={busy}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What's this post about? #hashtags"
                className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {caption.length}/{MAX_CAPTION_LENGTH}
              </p>
            </div>

            <div>
              <label htmlFor="page" className="text-xs font-semibold text-muted-foreground">
                Page
              </label>
              <select
                id="page"
                value={pageId}
                disabled={busy}
                onChange={(e) => setPageId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              >
                <option value="">Select a Page…</option>
                {pages.map((p) => (
                  <option key={p.page_id} value={p.page_id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {pages.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  No Pages found. Connect Facebook from Settings first.
                </p>
              )}
            </div>

            {scheduleOpen && (
              <div>
                <label htmlFor="schedule" className="text-xs font-semibold text-muted-foreground">
                  Schedule for
                </label>
                <input
                  id="schedule"
                  type="datetime-local"
                  value={scheduledAt}
                  disabled={busy}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
            )}

            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <Button variant="secondary" onClick={() => submit("draft")} disabled={busy}>
                <FloppyDisk size={16} /> {saving === "draft" ? "Saving…" : "Save draft"}
              </Button>
              {scheduleOpen ? (
                <Button variant="secondary" onClick={() => submit("schedule")} disabled={busy}>
                  <CalendarPlus size={16} /> {saving === "schedule" ? "Scheduling…" : "Confirm schedule"}
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setScheduleOpen(true)} disabled={busy}>
                  <CalendarPlus size={16} /> Schedule
                </Button>
              )}
              <Button onClick={() => submit("post_now")} disabled={busy}>
                <Rocket size={16} weight="fill" /> {saving === "post_now" ? "Publishing…" : "Publish now"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
