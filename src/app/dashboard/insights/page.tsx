import Link from "next/link";
import { Eye, UsersThree, HandHeart, UserPlus, WarningCircle, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { InsightsChart } from "@/components/insights/insights-chart";
import { PostInsightsList } from "@/components/insights/post-insights-list";
import { getPageInsights, INSIGHT_RANGES, type InsightRange } from "@/lib/facebook/insights";
import { FacebookNotConnectedError, NoPageSelectedError } from "@/lib/facebook/client";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const fmt = (n: number | null) => (n === null ? "–" : compact.format(n));

function Notice({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <Card className="border-warning/40 bg-warning/5">
      <div className="flex items-start gap-3">
        <WarningCircle size={22} className="mt-0.5 shrink-0 text-warning" weight="bold" />
        <div className="min-w-0">
          <h2 className="font-heading font-bold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          {href && cta && (
            <Link
              href={href}
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              {cta} <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rawRange } = await searchParams;
  const range = (INSIGHT_RANGES.find((r) => String(r) === rawRange) ?? 28) as InsightRange;

  let insights;
  try {
    insights = await getPageInsights(range);
  } catch (err) {
    if (err instanceof FacebookNotConnectedError) {
      return (
        <div className="mx-auto max-w-2xl">
          <Notice title="Facebook is not connected" body={err.message} href="/dashboard/settings" cta="Open Settings" />
        </div>
      );
    }
    if (err instanceof NoPageSelectedError) {
      return (
        <div className="mx-auto max-w-2xl">
          <Notice title="No Page selected" body={err.message} href="/dashboard/pages" cta="Choose a Page" />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-2xl">
        <Notice
          title="Could not load insights"
          body={err instanceof Error ? err.message : "Facebook did not respond. Try again in a moment."}
        />
      </div>
    );
  }

  const { page, totals, daily, posts, warnings } = insights;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {page.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={page.picture} alt="" className="h-11 w-11 rounded-full object-cover" />
          ) : (
            <div className="h-11 w-11 rounded-full bg-surface-2" />
          )}
          <div className="min-w-0">
            <h2 className="truncate font-heading text-lg font-bold text-foreground">{page.name}</h2>
            <p className="text-sm text-muted-foreground">
              {page.followers === null ? "Page insights" : `${page.followers.toLocaleString("en-US")} followers`}
            </p>
          </div>
        </div>
        <nav aria-label="Date range" className="flex gap-1 rounded-full bg-surface-2 p-1">
          {INSIGHT_RANGES.map((r) => (
            <Link
              key={r}
              href={`/dashboard/insights?range=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                r === range ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r} days
            </Link>
          ))}
        </nav>
      </div>

      {warnings.map((w) => (
        <div
          key={w}
          className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-sm text-foreground"
        >
          <WarningCircle size={18} className="mt-0.5 shrink-0 text-warning" />
          {w}
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`Views · ${range}d`} value={fmt(totals.views)} icon={Eye} tone="primary" />
        <StatCard label={`Viewers · ${range}d`} value={fmt(totals.viewers)} icon={UsersThree} />
        <StatCard label={`Engagements · ${range}d`} value={fmt(totals.engagements)} icon={HandHeart} tone="success" />
        <StatCard label={`New follows · ${range}d`} value={fmt(totals.follows)} icon={UserPlus} tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <h3 className="font-heading font-bold text-foreground">Daily performance</h3>
          <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
            Views count every time your content was seen; viewers count each person once per day.
          </p>
          <InsightsChart data={daily} />
        </Card>

        <Card>
          <h3 className="font-heading font-bold text-foreground">Recent posts</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Latest 12 posts on this Page, all time.</p>
          <PostInsightsList posts={posts} />
        </Card>
      </div>
    </div>
  );
}
