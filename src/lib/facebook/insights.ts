import { graph, FacebookNotConnectedError, NoPageSelectedError } from "@/lib/facebook/client";
import { getSettings } from "@/lib/db/settings";

/*
 * Meta retired the impressions metrics in Nov 2025; "views" (page_media_view)
 * and "viewers" (page_total_media_view_unique) are their replacements, and
 * are what Facebook's own Insights screen now shows.
 */
const DAILY_METRICS = {
  views: "page_media_view",
  viewers: "page_total_media_view_unique",
  engagements: "page_post_engagements",
  follows: "page_daily_follows_unique",
} as const;

type DailyKey = keyof typeof DAILY_METRICS;

export const INSIGHT_RANGES = [7, 28, 90] as const;
export type InsightRange = (typeof INSIGHT_RANGES)[number];

export interface DailyPoint {
  date: string;
  label: string;
  views: number | null;
  viewers: number | null;
  engagements: number | null;
  follows: number | null;
}

export interface PostInsight {
  id: string;
  message: string;
  createdTime: string;
  picture: string | null;
  permalink: string | null;
  reactions: number;
  comments: number;
  shares: number;
  views: number | null;
  viewers: number | null;
}

export interface PageInsights {
  page: { id: string; name: string; followers: number | null; picture: string | null };
  range: InsightRange;
  totals: Record<DailyKey, number | null>;
  daily: DailyPoint[];
  posts: PostInsight[];
  warnings: string[];
}

const PERMISSION_HINT =
  "Facebook did not allow reading insights. Add the read_insights and pages_read_engagement permissions to your Meta app (and its Login for Business configuration, if it uses one), then reconnect Facebook in Settings.";

function isPermissionError(err: unknown) {
  return err instanceof Error && /\(#10\)|\(#200\)|permission|read_insights/i.test(err.message);
}

type MetricResponse = { data?: Array<{ values?: Array<{ value: unknown; end_time: string }> }> };

async function fetchDailyMetric(
  pageId: string,
  token: string,
  metric: string,
  since: number,
  until: number
): Promise<Map<string, number>> {
  const res: MetricResponse = await graph(`/${pageId}/insights`, {
    metric,
    period: "day",
    since: String(since),
    until: String(until),
    access_token: token,
  });
  const byDay = new Map<string, number>();
  for (const v of res.data?.[0]?.values ?? []) {
    if (typeof v.value !== "number") continue;
    // end_time marks the end of the day the value covers.
    const day = new Date(new Date(v.end_time).getTime() - 1).toISOString().slice(0, 10);
    byDay.set(day, v.value);
  }
  return byDay;
}

type RawPost = {
  id: string;
  message?: string;
  created_time: string;
  full_picture?: string;
  permalink_url?: string;
  shares?: { count: number };
  reactions?: { summary?: { total_count: number } };
  comments?: { summary?: { total_count: number } };
  insights?: { data?: Array<{ name: string; values?: Array<{ value: unknown }> }> };
};

const POST_FIELDS =
  "id,message,created_time,full_picture,permalink_url,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)";

async function fetchPosts(pageId: string, token: string): Promise<{ posts: PostInsight[]; viewsMissing: boolean }> {
  let raw: RawPost[];
  let viewsMissing = false;
  try {
    const res = await graph(`/${pageId}/published_posts`, {
      fields: `${POST_FIELDS},insights.metric(post_media_view,post_total_media_view_unique)`,
      limit: "12",
      access_token: token,
    });
    raw = res.data ?? [];
  } catch {
    // Insights on posts need read_insights; the engagement counts do not, so
    // they can still be shown without it.
    const res = await graph(`/${pageId}/published_posts`, {
      fields: POST_FIELDS,
      limit: "12",
      access_token: token,
    });
    raw = res.data ?? [];
    viewsMissing = true;
  }

  const metric = (p: RawPost, name: string) => {
    const value = p.insights?.data?.find((m) => m.name === name)?.values?.[0]?.value;
    return typeof value === "number" ? value : null;
  };

  return {
    viewsMissing,
    posts: raw.map((p) => ({
      id: p.id,
      message: p.message ?? "",
      createdTime: p.created_time,
      picture: p.full_picture ?? null,
      permalink: p.permalink_url ?? null,
      reactions: p.reactions?.summary?.total_count ?? 0,
      comments: p.comments?.summary?.total_count ?? 0,
      shares: p.shares?.count ?? 0,
      views: metric(p, "post_media_view"),
      viewers: metric(p, "post_total_media_view_unique"),
    })),
  };
}

export async function getPageInsights(range: InsightRange): Promise<PageInsights> {
  const settings = await getSettings();
  if (!settings.facebook_user_token) throw new FacebookNotConnectedError();
  const pageId = settings.default_page_id;
  const token = settings.default_page_token;
  if (!pageId || !token) throw new NoPageSelectedError();

  const now = new Date();
  const until = Math.floor(now.getTime() / 1000);
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (range - 1));
  const since = Math.floor(start.getTime() / 1000);

  const keys = Object.keys(DAILY_METRICS) as DailyKey[];
  const [pageInfo, postsResult, ...metricResults] = await Promise.allSettled([
    graph(`/${pageId}`, { fields: "name,followers_count,fan_count,picture{url}", access_token: token }),
    fetchPosts(pageId, token),
    ...keys.map((k) => fetchDailyMetric(pageId, token, DAILY_METRICS[k], since, until)),
  ]);

  const warnings = new Set<string>();
  const series = {} as Record<DailyKey, Map<string, number> | null>;
  keys.forEach((k, i) => {
    const r = metricResults[i];
    if (r.status === "fulfilled") {
      series[k] = r.value;
    } else {
      series[k] = null;
      warnings.add(isPermissionError(r.reason) ? PERMISSION_HINT : `Could not load ${k}: ${String((r.reason as Error)?.message ?? r.reason)}`);
    }
  });

  const daily: DailyPoint[] = [];
  for (let i = 0; i < range; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    daily.push({
      date,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      views: series.views ? (series.views.get(date) ?? 0) : null,
      viewers: series.viewers ? (series.viewers.get(date) ?? 0) : null,
      engagements: series.engagements ? (series.engagements.get(date) ?? 0) : null,
      follows: series.follows ? (series.follows.get(date) ?? 0) : null,
    });
  }

  const totals = {} as Record<DailyKey, number | null>;
  for (const k of keys) {
    totals[k] = series[k] ? daily.reduce((sum, p) => sum + (p[k] ?? 0), 0) : null;
  }

  let posts: PostInsight[] = [];
  if (postsResult.status === "fulfilled") {
    posts = postsResult.value.posts;
    if (postsResult.value.viewsMissing) warnings.add(PERMISSION_HINT);
  } else {
    warnings.add(isPermissionError(postsResult.reason) ? PERMISSION_HINT : "Could not load recent posts.");
  }

  const info = pageInfo.status === "fulfilled" ? pageInfo.value : null;

  return {
    page: {
      id: pageId,
      name: info?.name ?? settings.default_page_name ?? "Your Page",
      followers: info?.followers_count ?? info?.fan_count ?? null,
      picture: info?.picture?.data?.url ?? null,
    },
    range,
    totals,
    daily,
    posts,
    warnings: [...warnings],
  };
}
