"use client";

import { useEffect, useState } from "react";
import type { ContentPlanResponse, ContentDay } from "@/app/api/plan/route";

const FORMAT_COLOURS: Record<string, string> = {
  Reel: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  Carousel: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Post: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Story: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  Meme: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  UGC: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

function viralBar(score: number) {
  const colour = score >= 80 ? "bg-emerald-400" : score >= 60 ? "bg-yellow-400" : "bg-orange-400";
  return (
    <div className="h-1.5 w-full rounded-full bg-white/10">
      <div className={`h-full rounded-full ${colour} transition-all`} style={{ width: `${score}%` }} />
    </div>
  );
}

function DayCard({ day }: { day: ContentDay }) {
  const [open, setOpen] = useState(false);
  const fmtClass = FORMAT_COLOURS[day.format] ?? "bg-white/10 text-white/60";

  return (
    <article className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 transition hover:border-[rgba(212,183,143,0.3)]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold editorial-muted">Day {day.day}</span>
          <span className="text-xs editorial-muted opacity-60">{day.date}</span>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${fmtClass}`}>
          {day.format}
        </span>
      </div>

      <p className="text-sm font-semibold leading-snug">{day.theme}</p>
      <p className="mt-1 text-xs editorial-muted italic">&quot;{day.hook}&quot;</p>

      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-xs editorial-muted">
          <span>Viral score</span>
          <span>{day.viralScore}/100</span>
        </div>
        {viralBar(day.viralScore)}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-white/5 p-2">
          <p className="text-xs editorial-muted">Likes</p>
          <p className="text-xs font-semibold">{day.predictedLikes.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-white/5 p-2">
          <p className="text-xs editorial-muted">Reach</p>
          <p className="text-xs font-semibold">{day.predictedReach.toLocaleString()}</p>
        </div>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-3 w-full text-xs editorial-muted hover:text-white transition"
      >
        {open ? "▲ Hide" : "▼ Caption & hashtags"}
      </button>

      {open && (
        <div className="mt-3 space-y-2 text-xs">
          <p className="text-white/70 leading-relaxed">{day.caption}</p>
          <div className="flex flex-wrap gap-1">
            {day.hashtags.map((h) => (
              <span key={h} className="rounded-full bg-white/5 px-2 py-0.5 editorial-muted">#{h}</span>
            ))}
          </div>
          <p className="editorial-muted">⏰ Best time: {day.bestPostingTime}</p>
        </div>
      )}
    </article>
  );
}

export default function ContentPlanPage() {
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("grow followers");
  const [loading, setLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [data, setData] = useState<ContentPlanResponse | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    let cancelled = false;

    async function loadLatestPlan() {
      try {
        const res = await fetch("/api/plan", { cache: "no-store" });
        if (!res.ok) return;
        const latest = (await res.json()) as ContentPlanResponse | null;
        if (!cancelled && latest) {
          setData(latest);
        }
      } catch {
        // Ignore hydration errors for saved content fetch.
      } finally {
        if (!cancelled) {
          setLoadingSaved(false);
        }
      }
    }

    void loadLatestPlan();

    return () => {
      cancelled = true;
    };
  }, []);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, audience, goal }),
      });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate plan");
    } finally {
      setLoading(false);
    }
  }

  // Format distribution summary
  const formatCounts = data?.plan.reduce((acc: Record<string, number>, d) => {
    acc[d.format] = (acc[d.format] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <p className="editorial-kicker">📅 AI Content Strategist</p>
        <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">30-Day Content Plan</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          Your AI generates a full month of ready-to-execute content — hooks, scripts, captions, hashtags, and posting times. One click. Zero guesswork.
        </p>
      </section>

      {/* Input form */}
      <section className="editorial-panel rounded-4xl p-6">
        <p className="text-sm font-semibold mb-4">Configure your plan</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs editorial-muted uppercase tracking-widest">Your Niche</label>
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. fitness, perfume, fashion…"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-[rgba(212,183,143,0.5)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs editorial-muted uppercase tracking-widest">Target Audience</label>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. men 20–35, fragrance lovers…"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-[rgba(212,183,143,0.5)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs editorial-muted uppercase tracking-widest">Main Goal</label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm outline-none focus:border-[rgba(212,183,143,0.5)]"
            >
              <option>grow followers</option>
              <option>drive sales</option>
              <option>build brand awareness</option>
              <option>increase engagement</option>
            </select>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="mt-5 rounded-2xl bg-[rgba(212,183,143,0.18)] border border-[rgba(212,183,143,0.4)] px-6 py-3 text-sm font-semibold hover:bg-[rgba(212,183,143,0.28)] transition disabled:opacity-50"
        >
          {loading ? "🔄 Building your 30-day plan… (20–40 sec)" : "📅 Generate 30-Day Plan"}
        </button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      {/* Plan results */}
      {data && (
        <>
          {/* Summary + format distribution */}
          <section className="editorial-panel rounded-4xl p-6">
            <p className="text-xs uppercase tracking-widest editorial-muted mb-2">Strategy Summary</p>
            <p className="text-sm text-white/80 leading-relaxed mb-5">{data.summary}</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(formatCounts || {}).map(([fmt, count]) => (
                <span key={fmt} className={`rounded-full border px-3 py-1 text-xs font-semibold ${FORMAT_COLOURS[fmt] ?? "bg-white/5 border-white/10"}`}>
                  {fmt} × {count}
                </span>
              ))}
            </div>
          </section>

          {/* View toggle */}
          <div className="flex items-center justify-between">
            <p className="text-xs editorial-muted">{data.plan.length} days planned</p>
            <div className="flex gap-2">
              <button
                onClick={() => setView("grid")}
                className={`rounded-xl px-3 py-1.5 text-xs border transition ${view === "grid" ? "border-[rgba(212,183,143,0.4)] bg-[rgba(212,183,143,0.12)]" : "border-white/10 bg-white/5"}`}
              >
                Grid
              </button>
              <button
                onClick={() => setView("list")}
                className={`rounded-xl px-3 py-1.5 text-xs border transition ${view === "list" ? "border-[rgba(212,183,143,0.4)] bg-[rgba(212,183,143,0.12)]" : "border-white/10 bg-white/5"}`}
              >
                List
              </button>
            </div>
          </div>

          {view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.plan.map((day) => <DayCard key={day.day} day={day} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {data.plan.map((day) => (
                <article key={day.day} className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] px-5 py-4 flex items-center gap-4">
                  <span className="w-14 shrink-0 text-xs editorial-muted font-semibold">Day {day.day}</span>
                  <span className="w-24 shrink-0 text-xs editorial-muted">{day.date}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${FORMAT_COLOURS[day.format] ?? ""}`}>{day.format}</span>
                  <span className="flex-1 text-sm truncate">{day.theme}</span>
                  <span className={`shrink-0 text-xs font-bold ${day.viralScore >= 70 ? "text-emerald-400" : "text-yellow-400"}`}>
                    🔥 {day.viralScore}
                  </span>
                  <span className="shrink-0 text-xs editorial-muted hidden lg:block">⏰ {day.bestPostingTime}</span>
                </article>
              ))}
            </div>
          )}

          <p className="text-xs editorial-muted text-center pb-4">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      )}

      {!data && !loading && !loadingSaved && (
        <section className="editorial-panel rounded-4xl p-10 text-center">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-sm editorial-muted">Hit <strong>Generate 30-Day Plan</strong> to get a complete content calendar with scripts, captions, and posting times for every day of the month.</p>
        </section>
      )}
    </div>
  );
}
