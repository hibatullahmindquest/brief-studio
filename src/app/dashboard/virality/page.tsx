"use client";

import { useEffect, useState } from "react";
import type { ViralityPrediction } from "@/app/api/virality/route";

const FORMAT_OPTIONS = ["Reel", "Carousel", "Post", "Story", "Meme", "UGC"];

function ScoreRing({ score, label, colour }: { score: number; label: string; colour: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="90" height="90" className="-rotate-90">
        <circle cx="45" cy="45" r={r} strokeWidth="6" className="stroke-white/10 fill-none" />
        <circle
          cx="45" cy="45" r={r}
          strokeWidth="6"
          fill="none"
          stroke={colour}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-lg font-bold -mt-17.5 relative z-10">{score}</span>
      <span className="mt-10 text-xs editorial-muted">{label}</span>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: ViralityPrediction["verdict"] }) {
  const styles: Record<string, string> = {
    "Low": "bg-red-500/20 text-red-300 border-red-500/30",
    "Average": "bg-orange-500/20 text-orange-300 border-orange-500/30",
    "Good": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    "Viral": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    "Mega Viral": "bg-violet-500/20 text-violet-300 border-violet-500/30",
  };
  return (
    <span className={`rounded-full border px-4 py-1.5 text-sm font-bold ${styles[verdict] ?? "bg-white/10"}`}>
      {verdict === "Mega Viral" ? "🚀 " : verdict === "Viral" ? "🔥 " : ""}{verdict}
    </span>
  );
}

export default function ViralityPage() {
  const [format, setFormat] = useState("Reel");
  const [hook, setHook] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [result, setResult] = useState<ViralityPrediction | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLatestPrediction() {
      try {
        const res = await fetch("/api/virality", { cache: "no-store" });
        if (!res.ok) return;
        const latest = (await res.json()) as ViralityPrediction | null;
        if (!cancelled && latest) {
          setResult(latest);
        }
      } catch {
        // Ignore load errors for historical result hydration.
      } finally {
        if (!cancelled) {
          setLoadingSaved(false);
        }
      }
    }

    void loadLatestPrediction();

    return () => {
      cancelled = true;
    };
  }, []);

  const hashtags = hashtagInput
    .split(/[\s,#]+/)
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  async function predict() {
    if (!caption.trim()) {
      setError("Please enter a caption to analyse.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/virality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, hook, caption, hashtags }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <p className="editorial-kicker">🚀 AI Virality Predictor</p>
        <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">Will It Go Viral?</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          Paste your hook, caption, and hashtags — our AI predicts expected likes, comments, reach, and gives you a viral score out of 100. Almost no tool offers this.
        </p>
      </section>

      {/* Input */}
      <section className="editorial-panel rounded-4xl p-6 space-y-4">
        <p className="text-sm font-semibold">Your post details</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs editorial-muted uppercase tracking-widest">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm outline-none focus:border-[rgba(212,183,143,0.5)]"
            >
              {FORMAT_OPTIONS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs editorial-muted uppercase tracking-widest">Hook (first 3 seconds)</label>
            <input
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              placeholder="e.g. Wait until you see the end…"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-[rgba(212,183,143,0.5)]"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs editorial-muted uppercase tracking-widest">Caption</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            placeholder="Paste your full caption here…"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] resize-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs editorial-muted uppercase tracking-widest">Hashtags (space or comma separated)</label>
          <input
            value={hashtagInput}
            onChange={(e) => setHashtagInput(e.target.value)}
            placeholder="fitness gym motivation health …"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-[rgba(212,183,143,0.5)]"
          />
          <div className="flex flex-wrap gap-1.5 mt-1">
            {hashtags.map((h) => (
              <span key={h} className="rounded-full bg-white/5 px-2 py-0.5 text-xs editorial-muted">#{h}</span>
            ))}
          </div>
        </div>

        <button
          onClick={predict}
          disabled={loading}
          className="rounded-2xl bg-[rgba(212,183,143,0.18)] border border-[rgba(212,183,143,0.4)] px-6 py-3 text-sm font-semibold hover:bg-[rgba(212,183,143,0.28)] transition disabled:opacity-50"
        >
          {loading ? "🔄 Analysing…" : "🔮 Predict Virality"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>

      {/* Results */}
      {result && (
        <>
          {/* Verdict + viral score */}
          <section className="editorial-panel rounded-4xl p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-6">
              <div>
                <p className="text-xs editorial-muted uppercase tracking-widest mb-2">Verdict</p>
                <VerdictBadge verdict={result.verdict} />
              </div>
              <div className="flex-1">
                <p className="text-xs editorial-muted mb-1">Overall Viral Score</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${result.viralScore >= 80 ? "bg-emerald-400" : result.viralScore >= 60 ? "bg-yellow-400" : "bg-orange-400"}`}
                      style={{ width: `${result.viralScore}%` }}
                    />
                  </div>
                  <span className="text-xl font-bold">{result.viralScore}/100</span>
                </div>
              </div>
            </div>

            {/* Sub-scores */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 place-items-center">
              <ScoreRing score={result.hookStrength} label="Hook Strength" colour="#a78bfa" />
              <ScoreRing score={result.captionScore} label="Caption Score" colour="#60a5fa" />
              <ScoreRing score={result.hashtagScore} label="Hashtag Score" colour="#34d399" />
              <ScoreRing score={result.trendAlignment} label="Trend Alignment" colour="#f472b6" />
            </div>
          </section>

          {/* Predicted metrics */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Predicted Likes", value: result.predictedLikes.toLocaleString(), icon: "❤️" },
              { label: "Predicted Comments", value: result.predictedComments.toLocaleString(), icon: "💬" },
              { label: "Predicted Reach", value: result.predictedReach.toLocaleString(), icon: "👁️" },
              { label: "Predicted Shares", value: result.predictedShares.toLocaleString(), icon: "↗️" },
              { label: "Predicted Saves", value: result.predictedSaves.toLocaleString(), icon: "🔖" },
            ].map((m) => (
              <article key={m.label} className="editorial-panel rounded-3xl p-5 text-center">
                <p className="text-2xl mb-1">{m.icon}</p>
                <p className="text-2xl font-bold">{m.value}</p>
                <p className="text-xs editorial-muted mt-1">{m.label}</p>
              </article>
            ))}
          </section>

          {/* Strengths / Weaknesses / Improvements */}
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="editorial-panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-widest text-emerald-400 mb-3">✅ Strengths</p>
              <ul className="space-y-2">
                {result.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-white/80 flex gap-2"><span>•</span>{s}</li>
                ))}
              </ul>
            </div>
            <div className="editorial-panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-widest text-red-400 mb-3">⚠️ Weaknesses</p>
              <ul className="space-y-2">
                {result.weaknesses.map((s, i) => (
                  <li key={i} className="text-sm text-white/80 flex gap-2"><span>•</span>{s}</li>
                ))}
              </ul>
            </div>
            <div className="editorial-panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-widest text-yellow-400 mb-3">💡 Improvements</p>
              <ul className="space-y-2">
                {result.improvements.map((s, i) => (
                  <li key={i} className="text-sm text-white/80 flex gap-2"><span>•</span>{s}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* Best posting time */}
          <section className="editorial-panel rounded-3xl p-5 flex flex-wrap gap-6">
            <div>
              <p className="text-xs editorial-muted uppercase tracking-widest mb-1">Best Posting Time</p>
              <p className="text-lg font-semibold">⏰ {result.bestPostingTime}</p>
            </div>
            <div>
              <p className="text-xs editorial-muted uppercase tracking-widest mb-1">Best Day</p>
              <p className="text-lg font-semibold">📅 {result.bestDay}</p>
            </div>
          </section>
        </>
      )}

      {!result && !loading && !loadingSaved && (
        <section className="editorial-panel rounded-4xl p-10 text-center">
          <p className="text-4xl mb-3">🔮</p>
          <p className="text-sm editorial-muted">Enter your post details above and hit <strong>Predict Virality</strong> to see AI-powered predictions for likes, comments, reach, and a viral score out of 100.</p>
        </section>
      )}
    </div>
  );
}
