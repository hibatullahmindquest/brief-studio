import { prisma } from "@/lib/prisma";

const MAX_DETAIL = 8000;

type Normalized = { message: string; code: string; status?: number; type: string; detail: string };

function safeStringify(v: unknown): string | null {
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

// Normalize ANY error into a rich shape. For OpenAI APIError, pulls
// status/code/type and the response body so the real cause is captured.
export function normalizeError(err: unknown): Normalized {
  const e = err as {
    message?: unknown; stack?: unknown; status?: unknown; code?: unknown; type?: unknown; error?: unknown;
  };
  const message = typeof e?.message === "string" ? e.message : String(err);
  const status = typeof e?.status === "number" ? e.status : undefined;
  const code = typeof e?.code === "string" ? e.code : status ? String(status) : "";
  const type =
    typeof e?.type === "string"
      ? e.type
      : err instanceof Error
        ? err.constructor.name
        : typeof err;

  const parts: string[] = [];
  if (typeof e?.stack === "string") parts.push(e.stack);
  if (e?.error !== undefined) {
    const body = safeStringify(e.error);
    if (body) parts.push("OpenAI body: " + body);
  }
  const detail = (parts.join("\n\n") || message).slice(0, MAX_DETAIL);

  return { message: message.slice(0, 1000), code, status, type, detail };
}

export type LogErrorInput = {
  source: string;
  error: unknown;
  level?: "error" | "warn";
  httpStatus?: number;
  userId?: string | null;
  brandId?: string | null;
  featureRunId?: string | null;
  context?: Record<string, unknown>; // sanitized — caller must not pass secrets
};

// Persist an error. Always echoes to console; the DB write is best-effort and
// NEVER throws — logging must not break the user-facing response.
export async function logError(input: LogErrorInput): Promise<void> {
  const n = normalizeError(input.error);
  console.error(`[${input.source}]`, n.message, n.code ? `(${n.code})` : "");
  try {
    await prisma.errorLog.create({
      data: {
        source: input.source,
        level: input.level ?? "error",
        message: n.message,
        code: n.code,
        httpStatus: input.httpStatus ?? n.status ?? null,
        detail: n.detail,
        userId: input.userId ?? null,
        brandId: input.brandId ?? null,
        featureRunId: input.featureRunId ?? null,
        contextJson: input.context ? safeStringify(input.context) : null,
      },
    });
  } catch (e) {
    console.error("[error-log] failed to persist:", e instanceof Error ? e.message : e);
  }
}

export async function getRecentErrors(opts?: { source?: string; level?: string; limit?: number }) {
  const where: { source?: string; level?: string } = {};
  if (opts?.source) where.source = opts.source;
  if (opts?.level) where.level = opts.level;
  return prisma.errorLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 50,
  });
}
