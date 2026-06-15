"use client";

import { useState } from "react";

export type LogRow = {
  id: string;
  source: string;
  level: string;
  message: string;
  code: string;
  httpStatus: number | null;
  detail: string;
  contextJson: string | null;
  createdAt: string;
};

function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "baru sahaja";
  if (mins < 60) return `${mins} minit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

export function LogsView({ rows }: { rows: LogRow[] }) {
  const [source, setSource] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);

  const sources = ["all", ...Array.from(new Set(rows.map((r) => r.source)))];
  const filtered = rows.filter(
    (r) => (source === "all" || r.source === source) && (level === "all" || r.level === level)
  );

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition ${
      active ? "bg-[var(--brand)] text-white" : "text-[#7b8698] hover:bg-[var(--card-2)] hover:text-[#33414f]"
    }`;

  return (
    <div className="v6-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#00262a]">Error logs</h2>
        <span className="rounded-full border border-[var(--line)] bg-[var(--card-2)] px-2 py-0.5 mono text-[10px] text-[#7b8698]">
          {filtered.length}
        </span>
      </div>

      {/* Filters */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <button key={s} className={chip(source === s)} onClick={() => setSource(s)}>
            {s}
          </button>
        ))}
        <span className="mx-1 w-px bg-[var(--line)]" />
        {["all", "error", "warn"].map((l) => (
          <button key={l} className={chip(level === l)} onClick={() => setLevel(l)}>
            {l}
          </button>
        ))}
      </div>

      {/* Rows */}
      <div className="mt-4">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#a6aebb]">Tiada error direkod 🎉</p>
        ) : (
          filtered.map((r) => (
            <div key={r.id} className="border-b border-[var(--line)] last:border-0">
              <button
                onClick={() => setOpen(open === r.id ? null : r.id)}
                className="flex w-full items-center gap-2 py-2.5 text-left"
              >
                <span
                  className="rounded-md px-1.5 py-0.5 mono text-[9px] font-bold uppercase"
                  style={{
                    background: r.level === "warn" ? "var(--warn-soft)" : "var(--stop-soft)",
                    color: r.level === "warn" ? "var(--warn)" : "var(--stop)",
                  }}
                >
                  {r.level}
                </span>
                <span className="mono text-[11px] text-[var(--brand)]">{r.source}</span>
                {(r.code || r.httpStatus) && (
                  <span className="mono text-[11px] text-[#a6aebb]">
                    {r.code || ""}{r.httpStatus ? ` · ${r.httpStatus}` : ""}
                  </span>
                )}
                <span className="truncate text-[13px] text-[#33414f]">{r.message}</span>
                <span className="ml-auto shrink-0 text-[10px] text-[#a6aebb]">{relTime(r.createdAt)}</span>
              </button>
              {open === r.id && (
                <div className="pb-3">
                  {r.contextJson && (
                    <pre className="mb-2 overflow-x-auto rounded-lg bg-[var(--card-2)] p-3 mono text-[11px] text-[#33414f]">
                      context: {r.contextJson}
                    </pre>
                  )}
                  <pre className="max-h-80 overflow-auto rounded-lg bg-[#00262a] p-3 mono text-[11px] leading-5 text-[#9fc3c9]">
                    {r.detail || "(no detail)"}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
