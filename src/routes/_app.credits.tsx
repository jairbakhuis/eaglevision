import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_app/credits")({
  component: CreditsPage,
  head: () => ({ meta: [{ title: "Credits — EagleVision" }] }),
});

const PROVIDERS = [
  { id: "google", name: "Google Gemini", url: "https://aistudio.google.com/app/apikey" },
  { id: "openai", name: "OpenAI", url: "https://platform.openai.com/account/billing" },
  { id: "anthropic", name: "Anthropic", url: "https://console.anthropic.com/settings/billing" },
  { id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/credits" },
  { id: "lovable", name: "Lovable AI", url: "https://lovable.dev/" },
];

function CreditsPage() {
  const [usage, setUsage] = useState<Record<string, { p: number; c: number }>>({});

  useEffect(() => {
    supabase
      .from("usage_log")
      .select("provider,prompt_tokens,completion_tokens")
      .then(({ data }) => {
        const agg: Record<string, { p: number; c: number }> = {};
        for (const r of data ?? []) {
          const k = r.provider as string;
          if (!agg[k]) agg[k] = { p: 0, c: 0 };
          agg[k].p += r.prompt_tokens ?? 0;
          agg[k].c += r.completion_tokens ?? 0;
        }
        setUsage(agg);
      });
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Credits & usage</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Token usage logged from your chats. Top up directly with each provider.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((p) => {
          const u = usage[p.id] ?? { p: 0, c: 0 };
          return (
            <Card key={p.id} className="p-5">
              <div className="text-sm font-medium text-muted-foreground">{p.name}</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">
                  {(u.p + u.c).toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">tokens used</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {u.p.toLocaleString()} prompt · {u.c.toLocaleString()} completion
              </div>
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
              >
                Buy credits →
              </a>
            </Card>
          );
        })}
      </div>
    </div>
  );
}