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

export type HistoryImage = {
  kind: string;
  aspect: string;
  urlPath: string;
  scenes: { no: number; caption: string }[];
};

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
  createdAt: string;
};

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

  return rows.flatMap((row) => {
    const output = safeParse<HistoryRun["fullOutput"] & { image?: HistoryImage }>(row.outputJson);
    if (!output) return [];
    const input = safeParse<{ brandSlug?: string; contentType?: string }>(row.inputJson);
    const outputTypeId = OUTPUT_TYPES.find((o) => o.label === input?.contentType)?.id ?? "";
    return [
      {
        id: row.id,
        subtype: row.subtype,
        brandSlug: input?.brandSlug ?? null,
        primaryPostExcerpt: (output.primaryPost ?? "").slice(0, 120),
        fullOutput: output,
        image: output.image ?? null,
        outputTypeId,
        createdAt: row.createdAt.toISOString(),
      },
    ];
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
