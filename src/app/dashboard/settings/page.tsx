import type { Metadata } from "next";
import Link from "next/link";
import { requireUser, getCurrentUserWithRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/settings-form";

export const metadata: Metadata = {
  title: "Dashboard Settings",
  description: "Manage account, brand voice, and publishing defaults.",
};

type Counts = {
  experts: { total: number; disabled: number };
  recipes: { total: number; disabled: number };
  users: { total: number; admins: number };
};

export default async function DashboardSettingsPage() {
  const user = await requireUser();
  const role = await getCurrentUserWithRole();
  const isAdmin = role?.isAdmin ?? false;

  let stats: Awaited<ReturnType<typeof prisma.stats.findUnique>> = null;
  let preference: Awaited<ReturnType<typeof prisma.userPreference.findUnique>> = null;
  let counts: Counts | null = null;

  try {
    [stats, preference] = await Promise.all([
      prisma.stats.findUnique({ where: { userId: user.id } }),
      prisma.userPreference.findUnique({ where: { userId: user.id } }),
    ]);
    if (isAdmin) {
      const [experts, expertsDisabled, recipes, recipesDisabled, users, admins] = await Promise.all([
        prisma.expert.count(),
        prisma.expert.count({ where: { enabled: false } }),
        prisma.recipe.count(),
        prisma.recipe.count({ where: { enabled: false } }),
        prisma.user.count(),
        prisma.user.count({ where: { isAdmin: true } }),
      ]);
      counts = {
        experts: { total: experts, disabled: expertsDisabled },
        recipes: { total: recipes, disabled: recipesDisabled },
        users: { total: users, admins },
      };
    }
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

      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminCard
            href="/dashboard/settings/experts"
            eyebrow="Pipeline"
            title="Experts"
            desc="System-prompt roles the generation pipeline runs."
            badge={counts ? `${counts.experts.total} total · ${counts.experts.disabled} disabled` : undefined}
          />
          <AdminCard
            href="/dashboard/settings/recipes"
            eyebrow="Pipeline"
            title="Recipes"
            desc="Ordered expert lineups per output type."
            badge={counts ? `${counts.recipes.total} total · ${counts.recipes.disabled} disabled` : undefined}
          />
          <AdminCard
            href="/dashboard/settings/users"
            eyebrow="Team"
            title="Team"
            desc="Roles, lens scope, and admin access."
            badge={counts ? `${counts.users.total} users · ${counts.users.admins} admin${counts.users.admins === 1 ? "" : "s"}` : undefined}
          />
          <AdminCard
            href="/dashboard/settings/brands"
            eyebrow="Brand"
            title="Logo, footer & knowledge"
            desc="Poster overlay furniture and AI grounding per brand."
          />
          <AdminCard
            href="/dashboard/settings/meta"
            eyebrow="Integrations"
            title="Meta connections"
            desc="Each brand's Facebook Page, Instagram, and ad accounts."
          />
          <AdminCard
            href="/dashboard/settings/logs"
            eyebrow="Diagnostics"
            title="Error logs"
            desc="Server & AI generation errors with full detail."
          />
        </div>
      )}

      <SettingsForm
        initialBrandName={stats?.brandName ?? user.name}
        initialTone={(preference?.defaultTone as "Bold" | "Luxury" | "Hype") ?? "Bold"}
        initialCoreOffer={preference?.coreOffer ?? "AI-powered social media copy system"}
      />
    </div>
  );
}

function AdminCard({
  href, eyebrow, title, desc, badge,
}: {
  href: string;
  eyebrow: string;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm transition hover:border-[var(--brand-line)]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{eyebrow}</p>
        {badge && (
          <span className="rounded-full border border-[var(--line-2)] px-2 py-0.5 text-[11px] text-[#7b8698]">{badge}</span>
        )}
      </div>
      <p className="mt-2 text-lg font-semibold text-[#00262a]">{title} →</p>
      <p className="mt-1 text-sm text-[#7b8698]">{desc}</p>
    </Link>
  );
}
