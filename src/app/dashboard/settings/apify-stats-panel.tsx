"use client";

import { useState } from "react";

interface Props {
  igHandle: string | null;
  igFollowers: number | null;
  igPosts: number | null;
  igAvgLikes: number | null;
  igAvgComments: number | null;
  igEngagementRate: number | null;
}

type ScrapeResult = {
  ok?: boolean;
  error?: string;
  ig?: {
    followers?: number | null;
    posts?: number | null;
    bio?: string | null;
    avgLikes?: number | null;
    avgComments?: number | null;
    engagementRate?: number | null;
    hashtagsUsed?: string[];
    latestCaptions?: string[];
  };
};

export function ApifyStatsPanel(props: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<ScrapeResult["ig"] | null>(null);

  const followers = live?.followers ?? props.igFollowers;
  const posts = live?.posts ?? props.igPosts;
  const avgLikes = live?.avgLikes ?? props.igAvgLikes;
  const avgComments = live?.avgComments ?? props.igAvgComments;
  const engagementRate = live?.engagementRate ?? props.igEngagementRate;
  const hashtagsUsed = live?.hashtagsUsed ?? [];
  const latestCaptions = live?.latestCaptions ?? [];
  const bio = live?.bio ?? null;

  const hasData = followers != null || posts != null || avgLikes != null;

  async function rescrape() {
    if (!props.igHandle) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/instagram/rescrape", { method: "POST" });
      const data = (await res.json()) as ScrapeResult;
      if (!res.ok || data.error) {
        setError(data.error ?? "Scrape failed. Try again.");
      } else if (data.ig) {
        setLive(data.ig);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="editorial-panel rounded-4xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-purple-500 via-pink-500 to-orange-400">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold">Instagram Analytics</p>
            <p className="text-xs editorial-muted mt-0.5">
              {props.igHandle ? `@${props.igHandle} · via Apify scraper` : "No handle set — complete onboarding to connect"}
            </p>
          </div>
        </div>

        {props.igHandle && (
          <button
            onClick={rescrape}
            disabled={loading}
            className="rounded-full border border-white/10 px-4 py-2 text-xs font-medium editorial-muted transition hover:border-white/20 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/80 inline-block" />
                Scraping…
              </>
            ) : (
              "↻ Re-scrape Instagram"
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {loading && (
        <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.02)] p-6 text-center space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          <p className="text-sm editorial-muted">Running Apify scraper… this takes up to 90 seconds</p>
        </div>
      )}

      {!loading && hasData && (
        <div className="space-y-4">
          {/* Core stats grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Followers" value={followers?.toLocaleString()} />
            <StatCard label="Total Posts" value={posts?.toLocaleString()} />
            <StatCard
              label="Engagement Rate"
              value={engagementRate != null ? `${engagementRate}%` : undefined}
              highlight={engagementRate != null && engagementRate > 3}
            />
            <StatCard label="Avg Likes / Post" value={avgLikes?.toLocaleString()} />
            <StatCard label="Avg Comments / Post" value={avgComments?.toLocaleString()} />
          </div>

          {/* Bio */}
          {bio && (
            <div className="rounded-2xl border border-white/10 p-4">
              <p className="text-xs editorial-muted mb-1">Bio</p>
              <p className="text-sm leading-6">{bio}</p>
            </div>
          )}

          {/* Top hashtags */}
          {hashtagsUsed.length > 0 && (
            <div className="rounded-2xl border border-white/10 p-4">
              <p className="text-xs editorial-muted mb-2">Top Hashtags Used</p>
              <div className="flex flex-wrap gap-2">
                {hashtagsUsed.map((h) => (
                  <span key={h} className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-xs editorial-muted">
                    #{h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Latest captions */}
          {latestCaptions.length > 0 && (
            <div className="rounded-2xl border border-white/10 p-4 space-y-2">
              <p className="text-xs editorial-muted">Latest Post Captions</p>
              {latestCaptions.map((c, i) => (
                <p key={i} className="text-xs editorial-muted border-l-2 border-white/10 pl-3 leading-5">
                  {c}
                </p>
              ))}
            </div>
          )}

          <p className="text-xs editorial-muted">
            Powered by <span className="text-foreground font-medium">Apify instagram-scraper</span>. Data is scraped from public Instagram profile.
          </p>
        </div>
      )}

      {!loading && !hasData && props.igHandle && (
        <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.02)] p-5 text-sm editorial-muted">
          No Instagram data yet. Click <strong className="text-foreground">↻ Re-scrape Instagram</strong> to fetch your stats.
        </div>
      )}

      {!loading && !hasData && !props.igHandle && (
        <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.02)] p-5 space-y-2">
          <p className="text-sm font-medium">What Apify pulls for you</p>
          <ul className="text-xs editorial-muted space-y-1 list-disc list-inside">
            <li>Followers count &amp; total posts</li>
            <li>Average likes &amp; comments per post</li>
            <li>Engagement rate</li>
            <li>Top hashtags used</li>
            <li>Latest post captions</li>
            <li>Bio text</li>
          </ul>
          <p className="text-xs editorial-muted pt-1">Go through the brand setup quiz to add your Instagram handle.</p>
        </div>
      )}
    </section>
  );
}

function StatCard({ label, value, highlight }: { label: string; value?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10"}`}>
      <p className="text-xs editorial-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${highlight ? "text-emerald-400" : ""}`}>
        {value ?? <span className="text-base editorial-muted">—</span>}
      </p>
    </div>
  );
}
