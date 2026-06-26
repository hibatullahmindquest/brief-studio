import type { JobRow } from "@/lib/job-store";
import { runGenerateHandler } from "./handlers/generate";
import { runRenderHandler } from "./handlers/render";

export type HandlerResult = {
  ok: boolean;
  resultKind?: string;     // visual back-compat ("image"|"skipped")
  result?: unknown;        // generic richer result
  costMyr?: number;
  retryable?: boolean;     // only read when ok === false
  reason?: string;
};

type Handler = (job: JobRow) => Promise<HandlerResult>;

const HANDLERS: Record<string, Handler> = {
  generate: runGenerateHandler,
  render: runRenderHandler,
  // meta_sync, analyze, video, signal registered by their modules later
};

export async function dispatch(job: JobRow): Promise<HandlerResult> {
  const handler = HANDLERS[job.kind];
  if (!handler) {
    return { ok: false, retryable: false, reason: `No handler for kind "${job.kind}"` };
  }
  return handler(job);
}
