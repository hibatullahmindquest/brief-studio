"use client";

import { useEffect, useState } from "react";
import type { IdeasResponse, ContentIdea } from "@/app/api/ideas/route";

const FORMAT_ICONS: Record<string, string> = {
  reel: "🎬",
  carousel: "📊",
  post: "📸",
  story: "💬",
  trend: "🔥",
};

function viralColour(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  return "text-orange-400";
}

function IdeaCard({ idea }: { idea: ContentIdea }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5 transition hover:border-[rgba(212,183,143,0.4)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{FORMAT_ICONS[idea.type] ?? "💡"}</span>
          <span className="text-xs uppercase tracking-widest editorial-muted">{idea.type}</span>
        </div>
        <span className={`text-sm font-bold ${viralColour(idea.viralScore)}`}>
          🔥 {idea.viralScore}/100
        </span>
      </div>

      <h3 className="mt-3 text-base font-semibold leading-snug">{idea.title}</h3>
      <p className="mt-1 text-sm editorial-muted italic">&quot;{idea.hook}&quot;</p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/5 p-2">
          <p className="text-xs editorial-muted">Likes</p>
          <p className="text-sm font-semibold">{idea.predictedLikes.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-white/5 p-2">
          <p className="text-xs editorial-muted">Comments</p>
          <p className="text-sm font-semibold">{idea.predictedComments.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-white/5 p-2">
          <p className="text-xs editorial-muted">Reach</p>
          <p className="text-sm font-semibold">{idea.predictedReach.toLocaleString()}</p>
        </div>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-4 w-full rounded-2xl border border-white/10 py-2 text-xs editorial-muted hover:bg-white/5 transition"
      >
        {open ? "▲ Hide details" : "▼ Full script & caption"}
      </button>

      {open && (
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-widest editorial-muted mb-1">Script</p>
            <p className="whitespace-pre-line leading-relaxed text-white/80">{idea.script}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest editorial-muted mb-1">Caption</p>
            <p className="leading-relaxed text-white/80">{idea.caption}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest editorial-muted mb-1">Visual Concept</p>
            <p className="text-white/70">{idea.visualConcept}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {idea.hashtags.map((h) => (
              <span key={h} className="rounded-full bg-white/5 px-3 py-1 text-xs editorial-muted">
                #{h}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4 text-xs editorial-muted">
            <span>⏰ {idea.bestPostingTime}</span>
            {idea.trendingAudio && <span>🎵 {idea.trendingAudio}</span>}
          </div>
        </div>
      )}
    </article>
  );
}

export default function AIIdeasPage() {
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("grow followers");
  const [loading, setLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [data, setData] = useState<IdeasResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLatestIdeas() {
      try {
        const res = await fetch("/api/ideas", { cache: "no-store" });
        if (!res.ok) return;
        const latest = (await res.json()) as IdeasResponse | null;
        if (!cancelled && latest) {
          setData(latest);
        }
      } catch {
        // Keep silent on background hydration load.
      } finally {
        if (!cancelled) {
          setLoadingSaved(false);
        }
      }
    }

    void loadLatestIdeas();

    return () => {
      cancelled = true;
    };
  }, []);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, audience, goal }),
      });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate ideas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <p className="editorial-kicker">🧠 AI Content Strategist</p>
        <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">Ideas Engine</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          Powered by real Instagram trend analysis + GPT-4o. Get viral reel scripts, carousel ideas, trending hashtags, and predicted engagement — all tailored to your niche.
        </p>
      </section>

      {/* Input form */}
      <section className="editorial-panel rounded-4xl p-6">
        <p className="text-sm font-semibold mb-4">Customise your ideas</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs editorial-muted uppercase tracking-widest">Your Niche</label>
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. gym, skincare, fashion…"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-[rgba(212,183,143,0.5)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs editorial-muted uppercase tracking-widest">Target Audience</label>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. women 18–30, gym beginners…"
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
          {loading ? "🔄 Generating ideas… (15–30 sec)" : "✨ Generate Ideas"}
        </button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      {/* Results */}
      {data && (
        <>
          {/* Trending signals */}
          <section className="editorial-panel rounded-4xl p-6">
            <p className="text-xs uppercase tracking-widest editorial-muted mb-4">📈 Trending Right Now</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs editorial-muted mb-2">Hot Hashtags</p>
                <div className="flex flex-wrap gap-2">
                  {data.trendingHashtags?.map((h) => (
                    <span key={h} className="rounded-full bg-[rgba(212,183,143,0.1)] border border-[rgba(212,183,143,0.2)] px-3 py-1 text-xs">
                      #{h}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs editorial-muted mb-2">Trending Audio</p>
                <div className="flex flex-wrap gap-2">
                  {data.trendingAudio?.map((a) => (
                    <span key={a} className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs">
                      🎵 {a}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Reel ideas */}
          {data.reels?.length > 0 && (
            <section>
              <p className="text-xs uppercase tracking-widest editorial-muted mb-3">🎬 Reel Ideas</p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.reels.map((idea, i) => <IdeaCard key={i} idea={idea} />)}
              </div>
            </section>
          )}

          {/* Carousel ideas */}
          {data.carousels?.length > 0 && (
            <section>
              <p className="text-xs uppercase tracking-widest editorial-muted mb-3">📊 Carousel Ideas</p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.carousels.map((idea, i) => <IdeaCard key={i} idea={idea} />)}
              </div>
            </section>
          )}

          {/* Trend ideas */}
          {data.trends?.length > 0 && (
            <section>
              <p className="text-xs uppercase tracking-widest editorial-muted mb-3">🔥 Trend Ideas</p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.trends.map((idea, i) => <IdeaCard key={i} idea={idea} />)}
              </div>
            </section>
          )}

          <p className="text-xs editorial-muted text-center pb-4">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      )}

      {!data && !loading && !loadingSaved && (
        <section className="editorial-panel rounded-4xl p-10 text-center">
          <p className="text-4xl mb-3">🧠</p>
          <p className="text-sm editorial-muted">Hit <strong>Generate Ideas</strong> to get viral reel scripts, carousel strategies, and trend predictions tailored to your brand.</p>
        </section>
      )}
    </div>
  );
}
