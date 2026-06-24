import { prisma } from "@/lib/prisma";
import { sumRunCostMyr } from "@/lib/usage";

// Module 1 Phase F — the artifact read-layer.
//
// The canonical way to read Module-1 run outputs from the `Artifact` rows that the recipe
// engine (Phase D) and render seam (Phase E) write. Owner-scoped. Deliberately separate from
// the LEGACY `getRecentFeatureRuns` (feature-store.ts), which parses the old outputJson shape
// and is left untouched. Phase G (Task Workspace UI) consumes these two functions.

const IMAGE = "image";
const PDF = "pdf";
// user-facing text artifact types — excludes `visual_direction` (internal render instruction).
const TEXT_TYPES = ["strategy", "copy", "social", "text"];

export type ArtifactRow = {
  id: string;
  type: string;
  content: unknown;
  mediaPath: string | null;
  exportFormat: string;
  createdAt: Date;
};

export type RunArtifacts = {
  run: { id: string; title: string; feature: string; brandSlug: string | null; status: string; createdAt: Date };
  images: ArtifactRow[]; // carousel / image-set, oldest first
  texts: ArtifactRow[]; // user-facing text, oldest first
  pdf: ArtifactRow | null; // latest exported PDF
  costMyr: number;
};

export type LibraryItem = {
  runId: string;
  title: string;
  feature: string;
  brandSlug: string | null;
  status: string;
  createdAt: Date;
  kinds: string[]; // distinct artifact types present
  thumbnailPath?: string; // first image mediaPath, if any
};

/** One run's artifacts, grouped. Owner-scoped → null if not found / not owned. */
export async function getRunArtifacts(runId: string, userId: string): Promise<RunArtifacts | null> {
  const run = await prisma.creativeRun.findFirst({
    where: { id: runId, userId },
    select: { id: true, title: true, feature: true, status: true, createdAt: true, brand: { select: { slug: true } } },
  });
  if (!run) return null;

  const rows = await prisma.artifact.findMany({
    where: { runId },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, content: true, mediaPath: true, exportFormat: true, createdAt: true },
  });

  const images = rows.filter((r) => r.type === IMAGE);
  const texts = rows.filter((r) => TEXT_TYPES.includes(r.type));
  const pdfs = rows.filter((r) => r.type === PDF);
  const pdf = pdfs.length ? pdfs[pdfs.length - 1] : null; // latest

  return {
    run: { id: run.id, title: run.title, feature: run.feature, brandSlug: run.brand?.slug ?? null, status: run.status, createdAt: run.createdAt },
    images,
    texts,
    pdf,
    costMyr: await sumRunCostMyr(runId),
  };
}

/**
 * Recent / Library list for a user. Newest first, owner-scoped, ONLY runs with ≥1 artifact.
 * Artifacts for the whole page are fetched in a single query (no N+1). Cursor = last runId.
 */
export async function listLibrary(userId: string, opts?: { limit?: number; cursor?: string }): Promise<LibraryItem[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
  const runs = await prisma.creativeRun.findMany({
    // Filter artifact-less runs at the DB level so pagination only traverses runs WITH
    // artifacts — otherwise an empty run consumes a page slot and a page comes back short.
    where: { userId, artifacts: { some: {} } },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: { id: true, title: true, feature: true, status: true, createdAt: true, brand: { select: { slug: true } } },
  });
  if (runs.length === 0) return [];

  // one batched artifact query for the whole page
  const ids = runs.map((r) => r.id);
  const arts = await prisma.artifact.findMany({
    where: { runId: { in: ids } },
    orderBy: { createdAt: "asc" },
    select: { runId: true, type: true, mediaPath: true },
  });

  const byRun = new Map<string, { kinds: Set<string>; thumb?: string }>();
  for (const a of arts) {
    let e = byRun.get(a.runId);
    if (!e) { e = { kinds: new Set() }; byRun.set(a.runId, e); }
    e.kinds.add(a.type);
    if (!e.thumb && a.type === IMAGE && a.mediaPath) e.thumb = a.mediaPath;
  }

  // preserve newest-first order; drop runs with no artifacts
  return runs.flatMap((r) => {
    const e = byRun.get(r.id);
    if (!e || e.kinds.size === 0) return [];
    return [{
      runId: r.id,
      title: r.title,
      feature: r.feature,
      brandSlug: r.brand?.slug ?? null,
      status: r.status,
      createdAt: r.createdAt,
      kinds: [...e.kinds],
      ...(e.thumb ? { thumbnailPath: e.thumb } : {}),
    }];
  });
}
