import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { ensureStatsForUser, UserStats } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Dashboard | PostForge AI",
  description:
    "Run growth operations, monitor campaign performance, and generate revenue-focused content in one personalized dashboard.",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const firstName = user.name.split(" ")[0];
  const stats: UserStats = await ensureStatsForUser(user);

  /* ── Not onboarded: locked state ──────────────────────────────────── */
  if (!stats.onboardingDone) {
    return (
      <div className="space-y-6">
        <header className="editorial-panel rounded-4xl p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="editorial-kicker">Overview</p>
              <h1 className="editorial-title mt-3 text-5xl tracking-tight sm:text-6xl">
                Welcome, {firstName} &mdash; let&apos;s set up your brand
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 editorial-muted">
                Your analytics, campaign data, and growth metrics will appear here once you
                complete your brand profile. It only takes 30 seconds.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard/analytics" className="editorial-button editorial-button-primary">
                Complete Brand Setup
              </Link>
            </div>
          </div>
        </header>

        {/* Locked metric cards */}
        <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {["Leads This Week", "Revenue Influenced", "Avg. CTR", "Posts Published"].map((label) => (
            <article key={label} className="editorial-panel rounded-3xl p-5 opacity-40 select-none">
              <p className="text-xs uppercase tracking-[0.2em] editorial-muted">{label}</p>
              <p className="mt-3 text-3xl font-semibold text-white/30">—</p>
            </article>
          ))}
        </section>

        {/* Locked banner */}
        <section className="editorial-panel rounded-4xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="editorial-title text-3xl">Stats locked until brand setup is complete</h2>
          <p className="mt-3 text-sm editorial-muted max-w-md mx-auto">
            Fill in your brand name and Instagram handle in Analytics to unlock your full
            dashboard: performance scores, campaigns, growth metrics and more.
          </p>
          <Link href="/dashboard/analytics" className="editorial-button editorial-button-primary mt-6 inline-flex">
            Go to Analytics Setup
          </Link>
        </section>

        {/* Ghost preview — dimmed, not interactive */}
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr] opacity-20 pointer-events-none select-none">
          <article className="editorial-panel rounded-4xl p-6 sm:p-8">
            <h2 className="editorial-title text-4xl">Performance</h2>
            <div className="mt-7 grid gap-6 lg:grid-cols-[250px_1fr] lg:items-center">
              <div className="relative mx-auto grid h-48 w-48 place-items-center rounded-full border border-white/10 bg-[rgba(255,255,255,0.02)]">
                <div className="absolute inset-3 rounded-full border border-(--accent)" />
                <div className="text-center">
                  <p className="text-5xl font-semibold">—</p>
                  <p className="text-xs uppercase tracking-[0.18em] editorial-muted">Score / 100</p>
                </div>
              </div>
              <div className="space-y-4">
                {["SMM Performance", "Influencer Performance", "Paid Creative Health"].map((lbl) => (
                  <div key={lbl}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="editorial-muted">{lbl}</span>
                      <span className="font-semibold">—</span>
                    </div>
                    <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]" />
                  </div>
                ))}
              </div>
            </div>
          </article>
          <article className="editorial-panel rounded-4xl p-6 sm:p-8">
            <h2 className="editorial-title text-4xl">Activity</h2>
            <div className="mt-4 h-56 rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.02)]" />
          </article>
        </section>
      </div>
    );
  }

  /* ── Onboarded: real stats ─────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      <header className="editorial-panel rounded-4xl p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="editorial-kicker">Overview &mdash; {stats.brandName ?? user.name}</p>
            <h1 className="editorial-title mt-3 text-5xl tracking-tight sm:text-6xl">
              Welcome back, {firstName} &mdash; let&apos;s convert more attention into revenue
            </h1>
            {stats.summary && (
              <p className="mt-4 max-w-2xl text-base leading-7 editorial-muted">{stats.summary}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/content-lab" className="editorial-button editorial-button-primary">
              Generate New Campaign Copy
            </Link>
            <Link href="/pricing" className="editorial-button editorial-button-secondary">
              Upgrade Plan
            </Link>
          </div>
        </div>
      </header>

      {/* Real KPI cards — driven by Apify IG data */}
      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {/* Followers */}
        <article className="editorial-panel rounded-3xl p-5 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] editorial-muted">People follow you</p>
            <span className="text-lg">👥</span>
          </div>
          <p className="mt-2 text-3xl font-semibold">
            {stats.igFollowers != null ? stats.igFollowers.toLocaleString() : stats.leadsThisWeek.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs editorial-muted">
            {stats.igFollowers != null
              ? stats.igFollowers >= 10000
                ? "🔥 You're in the 10k+ club"
                : stats.igFollowers >= 1000
                ? "Growing — keep posting consistently"
                : "Early stage — every follower counts"
              : "Connect Instagram to see real data"}
          </p>
        </article>

        {/* Avg Likes */}
        <article className="editorial-panel rounded-3xl p-5 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Avg likes per post</p>
            <span className="text-lg">❤️</span>
          </div>
          <p className="mt-2 text-3xl font-semibold">
            {stats.igAvgLikes != null ? stats.igAvgLikes.toLocaleString() : "—"}
          </p>
          <p className="mt-0.5 text-xs editorial-muted">
            {stats.igAvgLikes != null
              ? stats.igAvgLikes >= 500
                ? "💪 Strong content resonance"
                : stats.igAvgLikes >= 100
                ? "Decent — try more hooks and reels"
                : "Focus on hooks in the first 3 seconds"
              : "Connect Instagram in Analytics"}
          </p>
        </article>

        {/* Engagement */}
        <article className={`editorial-panel rounded-3xl p-5 flex flex-col gap-1 ${stats.igEngagementRate != null && stats.igEngagementRate > 3 ? "border-emerald-500/20" : ""}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] editorial-muted">How engaged your audience is</p>
            <span className="text-lg">📊</span>
          </div>
          <p className={`mt-2 text-3xl font-semibold ${stats.igEngagementRate != null && stats.igEngagementRate > 3 ? "text-emerald-400" : ""}`}>
            {stats.igEngagementRate != null ? `${stats.igEngagementRate}%` : `${stats.avgCtr}%`}
          </p>
          <p className="mt-0.5 text-xs editorial-muted">
            {stats.igEngagementRate != null
              ? stats.igEngagementRate > 6
                ? "🏆 Top tier — your audience loves you"
                : stats.igEngagementRate > 3
                ? "✅ Above average — solid community"
                : stats.igEngagementRate > 1
                ? "Average — experiment with CTAs"
                : "Low — try replies, polls, and questions"
              : "Engagement rate from your niche"}
          </p>
        </article>

        {/* Posts */}
        <article className="editorial-panel rounded-3xl p-5 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Posts you&apos;ve shared</p>
            <span className="text-lg">📸</span>
          </div>
          <p className="mt-2 text-3xl font-semibold">{stats.postsPublished.toLocaleString()}</p>
          <p className="mt-0.5 text-xs editorial-muted">
            {stats.postsPublished >= 100
              ? "💡 Consistent creator — algorithms reward you"
              : stats.postsPublished >= 30
              ? "Good volume — aim for 4–7 posts/week"
              : "Post more to grow faster — consistency wins"}
          </p>
        </article>
      </section>

      {/* Performance + Activity */}
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="editorial-panel rounded-4xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="editorial-title text-4xl">Performance</h2>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs editorial-muted">Month to date</span>
          </div>
          <div className="mt-7 grid gap-6 lg:grid-cols-[250px_1fr] lg:items-center">
            <div className="relative mx-auto grid h-48 w-48 place-items-center rounded-full border border-white/10 bg-[rgba(255,255,255,0.02)]">
              <div className="absolute inset-3 rounded-full border border-(--accent)" />
              <div className="text-center">
                <p className="text-5xl font-semibold">{stats.performanceScore}</p>
                <p className="text-xs uppercase tracking-[0.18em] editorial-muted">Score / 100</p>
              </div>
            </div>
            <div className="space-y-4">
              {(
                [
                  ["SMM Performance", stats.smmScore],
                  ["Influencer Performance", stats.influencerScore],
                  ["Paid Creative Health", stats.paidScore],
                ] as [string, number][]
              ).map(([label, value]) => (
                <div key={label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="editorial-muted">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,rgba(212,183,143,0.95),rgba(240,232,216,0.55))]"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="editorial-panel rounded-4xl p-6 sm:p-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="editorial-title text-4xl">Activity</h2>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs editorial-muted">Last 7 days</span>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.02)] p-4">
            <svg viewBox="0 0 620 230" className="h-56 w-full" role="img" aria-label="Activity chart">
              <path d="M18 180 C80 70, 150 190, 220 136 C280 88, 340 176, 410 112 C475 56, 548 170, 602 122" stroke="rgba(212,183,143,0.95)" strokeWidth="4" fill="none" strokeLinecap="round" />
              <path d="M18 172 C80 108, 150 164, 220 144 C280 126, 340 154, 410 132 C475 114, 548 148, 602 138" stroke="rgba(240,232,216,0.28)" strokeWidth="2" fill="none" strokeLinecap="round" />
              <circle cx="410" cy="112" r="8" fill="var(--accent)" />
            </svg>
            <div className="mt-2 flex justify-between px-2 text-xs editorial-muted">
              {"Su Mo Tu We Th Fr Sa".split(" ").map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
          </div>
        </article>
      </section>

      {/* Growth section — all from DB */}
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="editorial-kicker">Growth overview</p>
            <h2 className="editorial-title mt-2 text-4xl">
              {stats.brandName ?? "Your brand"} &mdash; growth at a glance
            </h2>
          </div>
          <Link href="/dashboard/analytics" className="editorial-button editorial-button-secondary">
            Full Analytics
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-3xl border border-white/10 bg-[rgba(212,183,143,0.12)] p-5">
            <p className="text-xs uppercase tracking-[0.18em] editorial-muted mb-4">Creator circle</p>
            <p className="text-3xl font-semibold">{stats.creatorCount.toLocaleString()}</p>
            <p className="text-xs editorial-muted mt-1">influencers</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5">
            <p className="text-xs uppercase tracking-[0.18em] editorial-muted mb-4">Followers / day</p>
            <p className="text-3xl font-semibold">{stats.followersPerDay.toLocaleString()}</p>
            <p className="text-xs editorial-muted mt-1">avg. daily growth</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5">
            <p className="text-xs uppercase tracking-[0.18em] editorial-muted mb-4">Avg Comments</p>
            <p className="text-3xl font-semibold">
              {stats.igAvgComments != null ? stats.igAvgComments.toLocaleString() : stats.viewsPerDay.toLocaleString()}
            </p>
            <p className="text-xs editorial-muted mt-1">{stats.igAvgComments != null ? "avg. per post" : "estimated reach"}</p>
          </article>
          <article className="grid place-items-center rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5 text-center">
            {stats.instagramHandle ? (
              <div>
                <p className="text-xs editorial-muted mb-2">Instagram</p>
                <p className="font-semibold text-sm">@{stats.instagramHandle}</p>
                <Link
                  href={`https://instagram.com/${stats.instagramHandle}`}
                  target="_blank"
                  className="mt-3 text-xs editorial-muted underline underline-offset-2"
                >
                  View profile
                </Link>
              </div>
            ) : (
              <Link href="/dashboard/analytics" className="editorial-button editorial-button-primary text-sm">
                Add Instagram
              </Link>
            )}
          </article>
        </div>
      </section>

      {/* AI Tools quick-access */}
      <section>
        <p className="text-xs uppercase tracking-[0.2em] editorial-muted mb-4">🤖 AI Growth Tools</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/dashboard/ideas" className="group editorial-panel rounded-3xl p-5 hover:border-[rgba(212,183,143,0.4)] transition border border-white/10">
            <p className="text-2xl mb-3">🧠</p>
            <p className="font-semibold text-sm">Ideas Engine</p>
            <p className="text-xs editorial-muted mt-1 leading-relaxed">AI-generated reel scripts, carousel ideas, trending hashtags & audio — tailored to your niche.</p>
            <p className="mt-4 text-xs text-[rgba(212,183,143,0.8)] group-hover:underline">Generate ideas →</p>
          </Link>
          <Link href="/dashboard/plan" className="group editorial-panel rounded-3xl p-5 hover:border-[rgba(212,183,143,0.4)] transition border border-white/10">
            <p className="text-2xl mb-3">📅</p>
            <p className="font-semibold text-sm">30-Day Content Plan</p>
            <p className="text-xs editorial-muted mt-1 leading-relaxed">One click to get a full month of hooks, captions, hashtags, and posting times. Zero guesswork.</p>
            <p className="mt-4 text-xs text-[rgba(212,183,143,0.8)] group-hover:underline">Build my plan →</p>
          </Link>
          <Link href="/dashboard/virality" className="group editorial-panel rounded-3xl p-5 hover:border-[rgba(212,183,143,0.4)] transition border border-white/10">
            <p className="text-2xl mb-3">🔮</p>
            <p className="font-semibold text-sm">Virality Predictor</p>
            <p className="text-xs editorial-muted mt-1 leading-relaxed">Paste your caption & hashtags — AI predicts likes, comments, reach, and gives a viral score out of 100.</p>
            <p className="mt-4 text-xs text-[rgba(212,183,143,0.8)] group-hover:underline">Test my post →</p>
          </Link>
          <Link href="/dashboard/notes" className="group editorial-panel rounded-3xl p-5 hover:border-[rgba(212,183,143,0.4)] transition border border-white/10">
            <p className="text-2xl mb-3">📝</p>
            <p className="font-semibold text-sm">Notes</p>
            <p className="text-xs editorial-muted mt-1 leading-relaxed">Capture caption ideas, strategy drafts, reminders, and creative sparks before they disappear.</p>
            <p className="mt-4 text-xs text-[rgba(212,183,143,0.8)] group-hover:underline">Open notes →</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
