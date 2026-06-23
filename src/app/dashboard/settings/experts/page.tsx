import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { listExperts } from "@/lib/admin/experts";
import { ExpertsAdmin, type ExpertRow } from "@/components/admin/ExpertsAdmin";

export const metadata: Metadata = {
  title: "Experts",
  description: "Manage AI expert roles and their system prompts.",
};

export default async function ExpertsPage() {
  await requireAdmin();

  let experts: ExpertRow[] = [];
  try {
    const rows = await listExperts();
    experts = rows.map((e) => ({
      id: e.id,
      roleKey: e.roleKey,
      name: e.name,
      systemPrompt: e.systemPrompt,
      modelTier: e.modelTier,
      enabled: e.enabled,
    }));
  } catch {
    // Keep the page available even when the DB is unreachable.
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#7b8698] hover:text-[#00262a]"
      >
        ← Settings
      </Link>

      <section className="editorial-panel rounded-3xl p-5 sm:p-6">
        <p className="editorial-kicker">Admin</p>
        <h1 className="editorial-title mt-3 text-2xl sm:text-3xl">Experts</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          Experts are the system-prompt-bearing roles the generation pipeline runs. Edit a
          prompt here and the next generation that uses it changes accordingly.
        </p>
      </section>

      <ExpertsAdmin initial={experts} />
    </div>
  );
}
