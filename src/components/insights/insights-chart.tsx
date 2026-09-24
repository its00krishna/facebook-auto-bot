"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { cn } from "@/lib/cn";
import type { DailyPoint } from "@/lib/facebook/insights";

const METRICS = [
  { key: "views", label: "Views" },
  { key: "viewers", label: "Viewers" },
  { key: "engagements", label: "Engagements" },
  { key: "follows", label: "New follows" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function InsightsChart({ data }: { data: DailyPoint[] }) {
  const available = METRICS.filter((m) => data.some((d) => d[m.key] !== null));
  const [metric, setMetric] = useState<MetricKey>(available[0]?.key ?? "views");
  const current = METRICS.find((m) => m.key === metric)!;

  if (available.length === 0) {
    return (
      <p className="flex h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
        Facebook did not return daily numbers for this Page yet.
      </p>
    );
  }

  return (
    <div>
      <div role="tablist" aria-label="Chart metric" className="mb-4 flex flex-wrap gap-1.5">
        {available.map((m) => (
          <button
            key={m.key}
            role="tab"
            aria-selected={m.key === metric}
            onClick={() => setMetric(m.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              m.key === metric
                ? "bg-primary text-primary-foreground"
                : "bg-surface-2 text-muted-foreground hover:text-foreground"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="insightsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tickFormatter={(v: number) => compact.format(v)}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: "var(--color-border)" }}
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              fontSize: 12,
              color: "var(--color-foreground)",
            }}
            formatter={(value) => [Number(value).toLocaleString("en-US"), current.label]}
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#insightsFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
