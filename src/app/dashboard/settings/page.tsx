import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
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
      <section className="editorial-panel rounded-3xl p-5 sm:p-6">
        <p className="editorial-kicker">Settings</p>
        <h1 className="editorial-title mt-3 text-2xl sm:text-3xl">Brand profile controls</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          Keep your outputs on-brand with clear defaults for tone, audience, and conversion goals.
        </p>
      </section>

      {/* Meta integration link */}
      <Link
        href="/dashboard/settings/meta"
        className="block rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm transition hover:border-[var(--brand-line)]"
      >
        <p className="eyebrow">Integrations</p>
        <p className="mt-2 text-lg font-semibold text-[#00262a]">Meta connections →</p>
        <p className="mt-1 text-sm text-[#7b8698]">
          Connect each brand&apos;s Facebook Page, Instagram, and ad accounts.
        </p>
      </Link>

      <SettingsForm
        initialBrandName={stats?.brandName ?? user.name}
        initialTone={(preference?.defaultTone as "Bold" | "Luxury" | "Hype") ?? "Bold"}
        initialCoreOffer={preference?.coreOffer ?? "AI-powered social media copy system"}
      />
    </div>
  );
}

