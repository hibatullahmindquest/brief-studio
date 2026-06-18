import { prisma } from "@/lib/prisma";
import { OUTPUT_TYPES } from "@/lib/conversation-engine";

export type PersistedFeature = "generate" | "ideas" | "plan" | "virality";

type SaveFeatureRunParams = {
  userId: string;
  feature: PersistedFeature;
  subtype?: string | null;
  input?: unknown;
  output: unknown;
};

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "non_serializable_payload" });
  }
}

function safeParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function saveFeatureRun(params: SaveFeatureRunParams) {
  return prisma.featureRun.create({
    data: {
      userId: params.userId,
      feature: params.feature,
      subtype: params.subtype ?? null,
      inputJson: params.input === undefined ? null : safeStringify(params.input),
      outputJson: safeStringify(params.output),
    },
  });
}

export async function getFeatureRunOwned(runId: string, userId: string) {
  return prisma.featureRun.findFirst({ where: { id: runId, userId } });
}

export async function updateFeatureRunOutput(runId: string, output: unknown) {
  await prisma.featureRun.update({
    where: { id: runId },
    data: { outputJson: safeStringify(output) },
  });
}

export async function updateFeatureRunInput(runId: string, input: unknown) {
  await prisma.featureRun.update({
    where: { id: runId },
    data: { inputJson: safeStringify(input) },
  });
}

export type RunStatus = "draft" | "confirmed" | "generated";

export async function setFeatureRunStatus(runId: string, status: RunStatus) {
  await prisma.featureRun.update({
    where: { id: runId },
    data: { status },
  });
}

export type HistoryImage = {
  kind: string;
  aspect: string;
  urlPath: string;
  scenes: { no: number; caption: string }[];
  generatedMs?: number; // wall-clock the worker took to generate (omitted on pre-fix runs)
  costMyr?: number;     // total MYR cost of the generation (omitted on pre-fix runs)
};

// Per-run visual state shown in Semakan Lepas. "text" = output type can't have a
// visual (no badge); "pending" = visual-capable but not generated yet; "draft" =
// a Creative Spec was synthesised but not yet generated (resumable idea).
export type VisualStatus = "text" | "ready" | "generating" | "failed" | "pending" | "draft";

export type HistoryRun = {
  id: string;
  subtype: string | null;
  brandSlug: string | null;
  primaryPostExcerpt: string;
  fullOutput: {
    primaryPost: string;
    caption: string;
    callToAction: string;
    hashtags: string[];
    strategyNote: string;
    generatedAt: string;
  };
  image: HistoryImage | null;
  outputTypeId: string;
  visualStatus: VisualStatus;
  createdAt: string;
};

// Output types that produce a visual (mirror of visual.ts kindForOutputType,
// kept local so this server module has no extra import).
const VISUAL_CAPABLE = new Set(["poster", "storyboard", "video_script"]);

function deriveVisualStatus(
  outputTypeId: string,
  hasImage: boolean,
  latestJobStatus: string | undefined,
  runStatus: string,
): VisualStatus {
  if (hasImage) return "ready"; // an image present = done, regardless of any later job
  if (!VISUAL_CAPABLE.has(outputTypeId)) return "text";
  if (latestJobStatus === "queued" || latestJobStatus === "processing") return "generating";
  if (latestJobStatus === "failed") return "failed";
  // Spec synthesised but not yet generated → a resumable Draft idea.
  if (runStatus === "draft" || runStatus === "confirmed") return "draft";
  return "pending";
}

export async function getRecentFeatureRuns(
  userId: string,
  limit = 10,
  cursor?: string
): Promise<HistoryRun[]> {
  const rows = await prisma.featureRun.findMany({
    where: { userId, feature: "generate" },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  // Parse rows first so we can collect ids for a single job lookup.
  const parsed = rows.flatMap((row) => {
    const output = safeParse<HistoryRun["fullOutput"] & { image?: HistoryImage }>(row.outputJson);
    if (!output) return [];
    const input = safeParse<{ brandSlug?: string; contentType?: string; visualSpec?: { angle?: string; brief?: string; headline?: string } }>(row.inputJson);
    const outputTypeId = OUTPUT_TYPES.find((o) => o.label === input?.contentType)?.id ?? "";
    return [{ row, output, input, outputTypeId }];
  });

  // Latest GenerationJob status per run (one query), to derive the visual badge.
  const ids = parsed.map((p) => p.row.id);
  const latestStatus = new Map<string, string>();
  if (ids.length > 0) {
    const jobs = await prisma.generationJob.findMany({
      where: { featureRunId: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: { featureRunId: true, status: true },
    });
    for (const j of jobs) {
      if (!latestStatus.has(j.featureRunId)) latestStatus.set(j.featureRunId, j.status); // first = latest
    }
  }

  return parsed.map(({ row, output, input, outputTypeId }) => {
    const image = output.image ?? null;
    // Drafts have no copy output — surface the spec's angle/headline so the
    // Semakan Lepas card reads "Idea: <angle>" instead of a blank line.
    const spec = input?.visualSpec;
    const draftLabel = spec ? (spec.angle || spec.headline || spec.brief || "Idea poster") : "Idea poster";
    // Guided-poster runs (draft AND generated-from-spec) have no copy output, so
    // fall back to the spec's angle/headline for the list line.
    const excerpt = (output.primaryPost ?? "").trim() || (spec ? draftLabel : "");
    return {
      id: row.id,
      subtype: row.subtype,
      brandSlug: input?.brandSlug ?? null,
      primaryPostExcerpt: excerpt.slice(0, 120),
      fullOutput: output,
      image,
      outputTypeId,
      visualStatus: deriveVisualStatus(outputTypeId, image !== null, latestStatus.get(row.id), row.status),
      createdAt: row.createdAt.toISOString(),
    };
  });
}

export async function getLatestFeatureRun<TOutput = unknown, TInput = unknown>(params: {
  userId: string;
  feature: PersistedFeature;
  subtype?: string;
}) {
  const where =
    typeof params.subtype === "string"
      ? { userId: params.userId, feature: params.feature, subtype: params.subtype }
      : { userId: params.userId, feature: params.feature };

  const row = await prisma.featureRun.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });

  if (!row) {
    return null;
  }

  const output = safeParse<TOutput>(row.outputJson);
  if (output === null) {
    return null;
  }

  return {
    output,
    input: safeParse<TInput>(row.inputJson),
    createdAt: row.createdAt.toISOString(),
    subtype: row.subtype,
  };
}
