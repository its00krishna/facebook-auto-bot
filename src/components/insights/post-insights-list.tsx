import { Eye, Heart, ChatCircle, ShareFat, ArrowSquareOut, ImageSquare } from "@phosphor-icons/react/dist/ssr";
import type { PostInsight } from "@/lib/facebook/insights";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function Metric({ icon: IconCmp, value, label }: { icon: typeof Eye; value: number | null; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <IconCmp size={14} aria-hidden="true" />
      <span className="sr-only">{label}: </span>
      {value === null ? "–" : compact.format(value)}
    </span>
  );
}

export function PostInsightsList({ posts }: { posts: PostInsight[] }) {
  if (posts.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No posts on this Page yet.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {posts.map((post) => (
        <li key={post.id} className="flex items-center gap-3 py-3">
          {post.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.picture} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground">
              <ImageSquare size={18} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {post.message.split("\n")[0] || "Post without caption"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <time dateTime={post.createdTime}>
                {new Date(post.createdTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </time>
              <Metric icon={Eye} value={post.views} label="Views" />
              <Metric icon={Heart} value={post.reactions} label="Reactions" />
              <Metric icon={ChatCircle} value={post.comments} label="Comments" />
              <Metric icon={ShareFat} value={post.shares} label="Shares" />
            </div>
          </div>
          {post.permalink && (
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              <ArrowSquareOut size={16} />
              <span className="sr-only">Open post on Facebook</span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
