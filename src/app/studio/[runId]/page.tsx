import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getRunArtifacts } from "@/lib/artifact-store";
import { ResultView } from "@/components/studio/ResultView";

// Phase G — deep-link result page. Server-renders a past run's grouped artifacts (owner-scoped)
// so Recent cards reopen runs and results are shareable. Lives inside studio/layout.tsx (shell).
// A draft with nothing generated yet shows a resume prompt rather than an empty result.
export default async function RunResultPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const artifacts = await getRunArtifacts(runId, user.id);
  if (!artifacts) notFound(); // not found / not owned

  const empty = artifacts.images.length === 0 && artifacts.texts.length === 0 && !artifacts.pdf;

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
      <Link href="/studio" className="mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)] hover:text-[var(--foreground)]">
        ← New
      </Link>
      <div className="mt-3">
        {empty ? (
          <section className="editorial-panel rounded-3xl p-6">
            <p className="editorial-kicker">{artifacts.run.status}</p>
            <h1 className="editorial-title mt-2 text-xl">Nothing generated yet</h1>
            <p className="mt-2 text-sm leading-7 editorial-muted">
              This run hasn&apos;t produced any output. Start a fresh brief in the studio to generate something.
            </p>
            <Link href="/studio" className="editorial-button editorial-button-primary mt-5 inline-flex">Go to Studio →</Link>
          </section>
        ) : (
          <ResultView runId={runId} initial={artifacts} />
        )}
      </div>
    </div>
  );
}
