import { Play } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { isVideoPost } from "@/lib/types";
import type { Post } from "@/lib/types";

export function PostThumb({
  post,
  className,
}: {
  post: Pick<Post, "image_url" | "image_source">;
  className?: string;
}) {
  if (isVideoPost(post)) {
    return (
      <div className={cn("relative shrink-0 overflow-hidden bg-surface-2", className)}>
        <video
          src={`${post.image_url}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          aria-hidden="true"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
          <Play size={14} weight="fill" />
          <span className="sr-only">Video</span>
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={post.image_url} alt="" className={cn("shrink-0 object-cover", className)} />
  );
}
