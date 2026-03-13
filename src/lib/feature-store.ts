import { prisma } from "@/lib/prisma";

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
  await prisma.featureRun.create({
    data: {
      userId: params.userId,
      feature: params.feature,
      subtype: params.subtype ?? null,
      inputJson: params.input === undefined ? null : safeStringify(params.input),
      outputJson: safeStringify(params.output),
    },
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
