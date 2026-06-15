import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getRecentErrors } from "@/lib/error-log";
import { LogsView, type LogRow } from "./logs-view";

export const metadata: Metadata = {
  title: "Error Logs",
  description: "Captured server and AI generation errors.",
};

export default async function LogsPage() {
  await requireAdmin();
  const rows = await getRecentErrors({ limit: 50 });

  const data: LogRow[] = rows.map((r) => ({
    id: r.id,
    source: r.source,
    level: r.level,
    message: r.message,
    code: r.code,
    httpStatus: r.httpStatus,
    detail: r.detail,
    contextJson: r.contextJson,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <section className="editorial-panel rounded-3xl p-5 sm:p-6">
        <p className="eyebrow">Admin · Logs</p>
        <h1 className="editorial-title mt-3 text-2xl sm:text-3xl">Error logs</h1>
        <p className="mt-3 text-sm editorial-muted">
          Server &amp; AI generation errors, newest first. Klik baris untuk lihat detail penuh (stack + OpenAI body).
        </p>
      </section>

      <LogsView rows={data} />
    </div>
  );
}
