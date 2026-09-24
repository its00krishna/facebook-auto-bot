"use client";

import { useRef, useState } from "react";
import { UploadSimple, X, ImageSquare, FilmSlate } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { formatBytes, UPLOAD_ACCEPT, type MediaType } from "@/lib/uploads";

export interface SelectedMedia {
  file: File;
  previewUrl: string;
  mediaType: MediaType;
}

export function MediaDropzone({
  media,
  onSelect,
  onClear,
  disabled,
  progress,
}: {
  media: SelectedMedia | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
  progress: number | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onSelect(file);
  }

  if (media) {
    return (
      <div>
        <div className="relative overflow-hidden rounded-xl border border-border bg-surface-2">
          {media.mediaType === "video" ? (
            <video src={media.previewUrl} controls playsInline className="aspect-square w-full bg-black object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.previewUrl} alt="Selected upload preview" className="aspect-square w-full object-contain" />
          )}

          {!disabled && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Remove file"
              className="absolute right-2 top-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
            >
              <X size={15} />
            </button>
          )}

          {progress !== null && (
            <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2">
              <div className="flex items-center justify-between text-xs font-medium text-white">
                <span>Uploading…</span>
                <span>{progress}%</span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/25"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Upload progress"
              >
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {media.mediaType === "video" ? <FilmSlate size={14} /> : <ImageSquare size={14} />}
          <span className="truncate">{media.file.name}</span>
          <span className="shrink-0">· {formatBytes(media.file.size)}</span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 hover:bg-surface-2"
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UploadSimple size={22} weight="bold" />
      </span>
      <span className="text-sm font-semibold text-foreground">Choose a photo or video</span>
      <span className="text-xs text-muted-foreground">
        Drag and drop, or click to browse
        <br />
        JPG, PNG, GIF up to 10 MB · MP4, MOV up to 50 MB
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </button>
  );
}
