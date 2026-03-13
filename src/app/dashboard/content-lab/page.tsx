import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DashboardGenerator } from "@/components/dashboard-generator";

export const metadata: Metadata = {
  title: "Dashboard Content Lab",
  description: "Generate and refine social media copy from one focused workspace.",
};

export default async function DashboardContentLabPage() {
  const user = await requireUser();
  let stats: Awaited<ReturnType<typeof prisma.stats.findUnique>> = null;
  let preference: Awaited<ReturnType<typeof prisma.userPreference.findUnique>> = null;

  try {
    [stats, preference] = await Promise.all([
      prisma.stats.findUnique({ where: { userId: user.id } }),
      prisma.userPreference.findUnique({ where: { userId: user.id } }),
    ]);
  } catch {
    // Keep content-lab page available in demo mode even when DB is unreachable.
  }

  const company = stats?.brandName ?? user.name;
  const defaultTone = (preference?.defaultTone as "Bold" | "Luxury" | "Hype") ?? "Hype";

  return (
    <div className="space-y-6">
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <p className="editorial-kicker">Content Lab</p>
        <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">Generate, test, and publish faster</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          Turn campaign goals into polished drafts, CTA angles, and hashtag sets in one place.
        </p>
      </section>
      <DashboardGenerator defaultBrandName={company} defaultTone={defaultTone} />
    </div>
  );
}
