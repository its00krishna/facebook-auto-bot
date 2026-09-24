"use client";

import { useState } from "react";
import { Sparkle, CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface GeminiKeyState {
  gemini_key_set?: boolean;
  gemini_key_hint?: string | null;
}

type Status = { tone: "success" | "error"; text: string } | null;

export function GeminiKeyCard({
  state,
  onChange,
}: {
  state: GeminiKeyState;
  onChange: (next: GeminiKeyState) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "clear" | null>(null);
  const [status, setStatus] = useState<Status>(null);

  async function call(route: string, body?: unknown) {
    const res = await fetch(`/api/gemini/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
    return data;
  }

  async function run(action: "save" | "test" | "clear") {
    setBusy(action);
    setStatus(null);
    try {
      if (action === "save") {
        const data = await call("key", { apiKey: apiKey.trim() });
        onChange({ gemini_key_set: data.gemini_key_set, gemini_key_hint: data.gemini_key_hint });
        setApiKey("");
        setStatus({ tone: "success", text: "Key verified and saved. AI images now use Gemini." });
      } else if (action === "test") {
        await call("test");
        setStatus({ tone: "success", text: "The saved key works." });
      } else {
        const data = await call("key/clear");
        onChange({ gemini_key_set: data.gemini_key_set, gemini_key_hint: data.gemini_key_hint });
        setStatus({ tone: "success", text: "Key removed. AI images use the free generator again." });
      }
    } catch (err) {
      setStatus({ tone: "error", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkle size={20} weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading font-bold text-foreground">Gemini image API</h2>
            {state.gemini_key_set ? (
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                Active {state.gemini_key_hint}
              </span>
            ) : (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                Optional
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Save a Google Gemini API key to create AI images with Gemini instead of the free
            generator. If Gemini fails, the free generator is used automatically. Get a key at{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              aistudio.google.com/apikey
            </a>
            .
          </p>

          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (apiKey.trim()) run("save");
            }}
          >
            <label htmlFor="gemini-key" className="sr-only">
              Gemini API key
            </label>
            <input
              id="gemini-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={state.gemini_key_set ? "Saved — paste a new key to replace" : "AIza…"}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <Button type="submit" size="sm" disabled={busy !== null || !apiKey.trim()}>
              {busy === "save" ? "Verifying…" : "Verify & save"}
            </Button>
          </form>

          {state.gemini_key_set && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => run("test")} disabled={busy !== null}>
                {busy === "test" ? "Checking…" : "Test saved key"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => run("clear")} disabled={busy !== null}>
                {busy === "clear" ? "Removing…" : "Remove key"}
              </Button>
            </div>
          )}

          {status && (
            <p
              role="status"
              className={
                status.tone === "success"
                  ? "mt-3 flex items-start gap-1.5 text-xs font-medium text-success"
                  : "mt-3 flex items-start gap-1.5 text-xs font-medium text-destructive"
              }
            >
              {status.tone === "success" ? (
                <CheckCircle size={14} className="mt-px shrink-0" />
              ) : (
                <WarningCircle size={14} className="mt-px shrink-0" />
              )}
              {status.text}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
