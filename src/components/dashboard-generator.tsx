"use client";

import { useEffect, useState } from "react";

export type ContentType =
  | "Instagram Post"
  | "Caption"
  | "Ad Copy"
  | "Gym Promotion"
  | "Streetwear Brand Post";

export type Tone = "Bold" | "Luxury" | "Hype";

export type GeneratedContent = {
  headline: string;
  primaryPost: string;
  caption: string;
  callToAction: string;
  hashtags: string[];
  strategyNote: string;
};

type TabState = {
  brandName: string;
  tone: Tone;
  product: string;
  output: GeneratedContent | null;
  generationCount: number;
  lastGeneratedLabel: string;
};

type GenerateHistoryResponse = {
  primaryPost?: string;
  caption?: string;
  callToAction?: string;
  hashtags?: string[];
  strategyNote?: string;
  generatedAt?: string;
  input?: {
    brandName?: string;
    tone?: string;
    product?: string;
    contentType?: string;
  };
} | null;

const contentTypes: ContentType[] = [
  "Instagram Post",
  "Caption",
  "Ad Copy",
  "Gym Promotion",
  "Streetwear Brand Post",
];

const tones: Tone[] = ["Bold", "Luxury", "Hype"];

const defaultProducts: Record<ContentType, string> = {
  "Instagram Post": "streetwear hoodie drop",
  "Caption": "new collection launch",
  "Ad Copy": "limited edition sneakers",
  "Gym Promotion": "gym membership deal",
  "Streetwear Brand Post": "graphic tee drop",
};

function makeDefaultTab(brandName: string, type: ContentType, defaultTone: Tone): TabState {
  return {
    brandName,
    tone: defaultTone,
    product: defaultProducts[type],
    output: null,
    generationCount: 0,
    lastGeneratedLabel: "Not generated yet",
  };
}

export function DashboardGenerator({
  defaultBrandName = "PostForge AI",
  defaultTone = "Hype",
}: {
  defaultBrandName?: string;
  defaultTone?: Tone;
}) {
  const [activeTab, setActiveTab] = useState<ContentType>("Instagram Post");
  const [tabs, setTabs] = useState<Record<ContentType, TabState>>(() =>
    Object.fromEntries(
      contentTypes.map((ct) => [ct, makeDefaultTab(defaultBrandName, ct, defaultTone)])
    ) as Record<ContentType, TabState>
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const tab = tabs[activeTab];

  function updateTab(patch: Partial<TabState>) {
    setTabs((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], ...patch },
    }));
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSavedGeneration() {
      setIsLoadingHistory(true);

      try {
        const res = await fetch(`/api/generate?contentType=${encodeURIComponent(activeTab)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;

        const data = (await res.json()) as GenerateHistoryResponse;
        if (!data || cancelled) return;

        setTabs((prev) => {
          const current = prev[activeTab];
          return {
            ...prev,
            [activeTab]: {
              ...current,
              brandName: data.input?.brandName || current.brandName,
              tone: (data.input?.tone as Tone) || current.tone,
              product: data.input?.product || current.product,
              output: {
                headline: "Last saved draft",
                primaryPost: data.primaryPost || "",
                caption: data.caption || "",
                callToAction: data.callToAction || "",
                hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
                strategyNote: data.strategyNote || "",
              },
              lastGeneratedLabel: data.generatedAt
                ? `Saved ${new Date(data.generatedAt).toLocaleString()}`
                : current.lastGeneratedLabel,
            },
          };
        });
      } catch {
        // Silent: initial history load should not block generation UX.
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    }

    void loadSavedGeneration();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    const nextCount = tab.generationCount + 1;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: tab.brandName,
          tone: tab.tone,
          product: tab.product,
          contentType: activeTab,
          variant: nextCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error ?? "Generation failed. Please try again.");
        return;
      }
      updateTab({
        output: {
          headline: `AI draft #${nextCount}`,
          primaryPost: data.primaryPost || "",
          caption: data.caption || "",
          callToAction: data.callToAction || "",
          hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
          strategyNote: data.strategyNote || "",
        },
        generationCount: nextCount,
        lastGeneratedLabel: data.generatedAt
          ? `Saved ${new Date(data.generatedAt).toLocaleString()}`
          : `Generated version ${nextCount}`,
      });
    } catch (e) {
      console.error(e);
      setGenerateError("Network error. Please check your connection and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="editorial-panel rounded-4xl p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap gap-3">
          {contentTypes.map((item) => {
            const active = item === activeTab;
            return (
              <button
                key={item}
                type="button"
                onClick={() => { setActiveTab(item); setGenerateError(null); }}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "border-(--accent) bg-[rgba(255,255,255,0.04)] text-foreground"
                    : "border-white/10 bg-[rgba(255,255,255,0.02)] text-muted hover:text-foreground"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div className="space-y-5">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Brand name</span>
            <input
              value={tab.brandName}
              onChange={(event) => updateTab({ brandName: event.target.value })}
              className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm outline-none transition placeholder:text-muted focus:border-(--accent)"
              placeholder="Your brand or business"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Tone</span>
            <select
              value={tab.tone}
              onChange={(event) => updateTab({ tone: event.target.value as Tone })}
              className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm outline-none transition focus:border-(--accent)"
            >
              {tones.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Product or promotion</span>
            <input
              value={tab.product}
              onChange={(event) => updateTab({ product: event.target.value })}
              className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm outline-none transition placeholder:text-muted focus:border-(--accent)"
              placeholder="New drop, promo, service, or launch"
            />
          </label>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isGenerating ? "Generating..." : "Generate Post"}
          </button>

          {generateError && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              ⚠️ {generateError}
            </div>
          )}
        </div>
      </div>

      <div className="editorial-panel rounded-4xl p-6 sm:p-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="editorial-kicker">AI generated content</p>
            <h3 className="editorial-title mt-1 text-4xl">High-converting output pack</h3>
          </div>
          <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium editorial-muted">
            {isLoadingHistory ? "Loading saved drafts..." : tab.lastGeneratedLabel}
          </div>
        </div>

        {tab.output ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 p-5">
              <p className="text-xs uppercase tracking-[0.24em] editorial-muted">Primary Draft</p>
              <p className="editorial-title mt-3 text-3xl">{tab.output.headline}</p>
              <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-7 editorial-muted">
                {tab.output.primaryPost}
              </pre>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 p-5">
                <p className="text-xs uppercase tracking-[0.24em] editorial-muted">Caption Angle</p>
                <p className="mt-3 text-sm leading-7 editorial-muted">{tab.output.caption}</p>
              </div>
              <div className="rounded-3xl border border-white/10 p-5">
                <p className="text-xs uppercase tracking-[0.24em] editorial-muted">CTA</p>
                <p className="mt-3 text-sm leading-7 editorial-muted">{tab.output.callToAction}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 p-5">
              <p className="text-xs uppercase tracking-[0.24em] editorial-muted">Suggested Hashtags</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tab.output.hashtags.map((tag: string, i: number) => (
                  <span
                    key={`${tag}-${i}`}
                    className="rounded-full border border-white/10 px-3 py-2 text-xs font-medium editorial-muted"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 p-5">
              <p className="text-xs uppercase tracking-[0.24em] editorial-muted">Strategy Note</p>
              <p className="mt-3 text-sm leading-7 editorial-muted">{tab.output.strategyNote}</p>
            </div>
          </div>
        ) : (
          <div className="min-h-80 rounded-3xl border border-white/10 p-5 text-sm leading-7 editorial-muted">
            Choose your content settings, then click `Generate Post` to create a stronger AI draft with a main post, caption angle, CTA, hashtags, and strategy note.
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Hook optimized", active: !!tab.output },
            { label: "Conversion CTA included", active: !!(tab.output?.callToAction) },
            { label: "Hashtag pack included", active: !!(tab.output?.hashtags?.length) },
            { label: "Generated by OpenAI", active: !!tab.output },
          ].map(({ label, active }) => (
            <div
              key={label}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-medium transition ${
                active
                  ? "border-(--accent)/40 bg-[rgba(255,255,255,0.03)] text-foreground"
                  : "border-white/10 editorial-muted"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-emerald-400" : "bg-white/20"}`}
              />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
