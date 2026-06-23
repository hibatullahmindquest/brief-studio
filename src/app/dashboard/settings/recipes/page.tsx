import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { listRecipes } from "@/lib/admin/recipes";
import { listExperts } from "@/lib/admin/experts";
import { RecipesAdmin, type RecipeRow } from "@/components/admin/RecipesAdmin";
import type { RecipeStep, ExpertOption } from "@/components/admin/RecipeStepsBuilder";

export const metadata: Metadata = {
  title: "Recipes",
  description: "Manage generation recipes — ordered expert lineups per task type.",
};

export default async function RecipesPage() {
  await requireAdmin();

  let recipes: RecipeRow[] = [];
  let experts: ExpertOption[] = [];
  try {
    const [recipeRows, expertRows] = await Promise.all([listRecipes(), listExperts()]);
    recipes = recipeRows.map((r) => ({
      id: r.id,
      taskType: r.taskType,
      group: r.group,
      outputFormat: r.outputFormat,
      enabled: r.enabled,
      lenses: r.lenses,
      steps: Array.isArray(r.steps) ? (r.steps as unknown as RecipeStep[]) : [],
    }));
    experts = expertRows.map((e) => ({ roleKey: e.roleKey, name: e.name, enabled: e.enabled }));
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
        <h1 className="editorial-title mt-3 text-2xl sm:text-3xl">Recipes</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          A recipe is an ordered lineup of experts the pipeline runs to produce one task
          type&apos;s output. Reorder the steps, override a step&apos;s model tier, and pick the
          lenses it applies to. Experts come from Settings / Experts.
        </p>
      </section>

      <RecipesAdmin initial={recipes} experts={experts} />
    </div>
  );
}
