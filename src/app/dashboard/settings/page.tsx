import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ApifyStatsPanel } from "./apify-stats-panel";
import { SettingsForm } from "@/components/settings-form";

export const metadata: Metadata = {
  title: "Dashboard Settings",
  description: "Manage account, brand voice, and publishing defaults.",
};

export default async function DashboardSettingsPage() {
  const user = await requireUser();
  let stats: Awaited<ReturnType<typeof prisma.stats.findUnique>> = null;
  let preference: Awaited<ReturnType<typeof prisma.userPreference.findUnique>> = null;

  try {
    [stats, preference] = await Promise.all([
      prisma.stats.findUnique({ where: { userId: user.id } }),
      prisma.userPreference.findUnique({ where: { userId: user.id } }),
    ]);
  } catch {
    // Keep settings page available in demo mode even when DB is unreachable.
  }

  return (
    <div className="space-y-6">
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <p className="editorial-kicker">Settings</p>
        <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">Brand profile controls</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          Keep your outputs on-brand with clear defaults for tone, audience, and conversion goals.
        </p>
      </section>

      {/* Instagram stats via Apify */}
      <ApifyStatsPanel
        igHandle={stats?.instagramHandle ?? null}
        igFollowers={stats?.igFollowers ?? null}
        igPosts={stats?.igPosts ?? null}
        igAvgLikes={stats?.igAvgLikes ?? null}
        igAvgComments={stats?.igAvgComments ?? null}
        igEngagementRate={stats?.igEngagementRate ?? null}
      />

      <SettingsForm
        initialBrandName={stats?.brandName ?? user.name}
        initialTone={(preference?.defaultTone as "Bold" | "Luxury" | "Hype") ?? "Bold"}
        initialCoreOffer={preference?.coreOffer ?? "AI-powered social media copy system"}
      />
    </div>
  );
}

