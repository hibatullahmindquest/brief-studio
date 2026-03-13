import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { ensureStatsForUser } from "@/lib/stats";
import { BrandOnboarding } from "@/components/brand-onboarding";

export const metadata: Metadata = {
  title: "Dashboard Analytics",
  description: "Detailed analytics for PostForge AI growth and campaign performance.",
};

export default async function DashboardAnalyticsPage() {
  const user = await requireUser();
  const stats = await ensureStatsForUser(user);

  // Show one-time onboarding quiz until brand completes it
  if (!stats.onboardingDone) {
    return (
      <div className="space-y-6">
        <BrandOnboarding />
      </div>
    );
  }

  const displayBrand = stats.brandName ?? user.name;

  const metrics = [
    {
      label: "People reached this week",
      value: stats.igFollowers != null ? stats.igFollowers.toLocaleString() : stats.leadsThisWeek.toLocaleString(),
      sub: stats.igFollowers != null ? "Instagram followers" : "estimated leads",
      emoji: "👥",
    },
    {
      label: "Revenue your content drives",
      value: `£${stats.revenue.toLocaleString()}`,
      sub: stats.revenue > 0 ? "influenced by your posts" : "start tracking sales",
      emoji: "💰",
    },
    {
      label: "Click-through rate",
      value: `${stats.igEngagementRate ?? stats.avgCtr}%`,
      sub: (stats.igEngagementRate ?? stats.avgCtr) > 3 ? "above average — great!" : "industry avg is 1–3%",
      emoji: "🎯",
    },
    {
      label: "Posts you've published",
      value: stats.postsPublished.toLocaleString(),
      sub: stats.postsPublished >= 30 ? "stay consistent!" : "aim for 4–7 posts/week",
      emoji: "📸",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="editorial-kicker">Analytics — {displayBrand}</p>
            <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">
              Performance &amp; growth intelligence
            </h1>
            {stats.summary && (
              <p className="mt-4 text-sm leading-7 editorial-muted">{stats.summary}</p>
            )}
          </div>
          {stats.instagramHandle && (
            <a
              href={`https://instagram.com/${stats.instagramHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-medium editorial-muted transition hover:border-white/30 hover:text-foreground"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.975.975 1.246 2.242 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.975.975-2.242 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.308-.975-.975-1.246-2.242-1.308-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608C4.516 2.497 5.783 2.226 7.15 2.163 8.416 2.105 8.796 2.163 12 2.163zm0-2.163c-3.259 0-3.667.014-4.947.072-1.52.069-2.875.415-3.95 1.489C2.028 2.638 1.682 3.993 1.613 5.513 1.555 6.793 1.541 7.201 1.541 12c0 4.799.014 5.207.072 6.487.069 1.52.415 2.875 1.489 3.95 1.075 1.074 2.43 1.42 3.95 1.489C8.333 23.986 8.741 24 12 24c3.259 0 3.667-.014 4.947-.072 1.52-.069 2.875-.415 3.95-1.489 1.074-1.075 1.42-2.43 1.489-3.95.058-1.28.072-1.688.072-6.487 0-4.799-.014-5.207-.072-6.487-.069-1.52-.415-2.875-1.489-3.95C19.822.487 18.467.141 16.947.072 15.667.014 15.259 0 12 0z"/>
                <path d="M12 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
              </svg>
              @{stats.instagramHandle}
            </a>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="editorial-panel rounded-3xl p-5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] editorial-muted leading-snug">{metric.label}</p>
              <span className="text-xl">{metric.emoji}</span>
            </div>
            <p className="mt-2 text-3xl font-semibold">{metric.value}</p>
            <p className="mt-0.5 text-xs editorial-muted">{metric.sub}</p>
          </article>
        ))}
      </section>

      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="editorial-title text-3xl">Weekly activity trend</h2>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs editorial-muted">Last 7 days</span>
        </div>
        <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.02)] p-4">
          <svg viewBox="0 0 640 220" className="h-56 w-full" role="img" aria-label="Weekly activity trend">
            <rect x="0" y="0" width="640" height="220" fill="transparent" />
            <path d="M20 176 C90 64, 150 180, 220 120 C290 70, 350 152, 420 96 C490 40, 550 164, 620 112" stroke="rgba(212,183,143,0.8)" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M20 188 C90 106, 150 190, 220 142 C290 96, 350 168, 420 126 C490 80, 550 180, 620 140" stroke="rgba(240,232,216,0.25)" strokeWidth="2" fill="none" strokeLinecap="round" />
            <circle cx="420" cy="96" r="8" fill="var(--accent)" />
          </svg>
        </div>
      </section>
    </div>
  );
}
