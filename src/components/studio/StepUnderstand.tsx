"use client";

import { useMemo, useState } from "react";
import type { StudioResponse, Gap, RecipeRef } from "@/lib/router";

// Phase G — Step 2. Two sub-phases:
//   "gaps"    — show what the router understood + collect answers to the gaps (PATCH applyAnswers).
//   "summary" — once the brief is complete, show a plain-language summary of WHAT WILL BE BUILT
//               and require an explicit Confirm before any generation starts.
// Answers persist via PATCH /api/studio/[runId]; confirm hands off to the orchestrator (generate).

type Cleared = { recipe: RecipeRef | null; taskType: string; brief: Record<string, string> };

const TASK_TYPES: { key: string; label: string }[] = [
  { key: "poster", label: "Poster / Image" },
  { key: "caption", label: "Caption / Post" },
  { key: "marketing_plan", label: "Marketing Plan" },
];
const PLATFORMS = ["Instagram", "Facebook", "TikTok", "YouTube", "WhatsApp"];
const SPEC_LABELS: Record<string, string> = {
  objective: "Objective", platform: "Platform", key_message: "Key message",
  audience: "Audience", timeframe: "Timeframe", ratio: "Ratio", angle: "Angle",
};

const isSentinel = (f: string) => f === "task_type" || f === "clarification";

export function StepUnderstand({
  runId, intake, onBack, onCleared,
}: { runId: string; intake: StudioResponse; onBack: () => void; onCleared: (c: Cleared) => void }) {
  const [phase, setPhase] = useState<"gaps" | "summary">("gaps");
  const [recipe, setRecipe] = useState<RecipeRef | null>(intake.recipe);
  const [taskType, setTaskType] = useState<string>(intake.taskType);
  const [gaps, setGaps] = useState<Gap[]>(intake.gaps);
  const [spec, setSpec] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);

  const originalQ = useMemo(() => Object.fromEntries(intake.gaps.map((g) => [g.field, g.question])), [intake.gaps]);
  const questionFor = (g: Gap) => originalQ[g.field] ?? g.question;

  const taskTypeGap = gaps.find((g) => isSentinel(g.field));
  const fieldGaps = gaps.filter((g) => !isSentinel(g.field));

  async function patch(body: { answers?: Record<string, string>; taskType?: string }): Promise<{ recipe: RecipeRef | null; gaps: Gap[]; taskType: string; spec: Record<string, string> } | null> {
    setError(null); setBusy(true);
    try {
      const res = await fetch(`/api/studio/${runId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError({ message: data.error ?? "Could not save answers", retryable: !!data.retryable }); return null; }
      setRecipe(data.recipe); setTaskType(data.taskType); setGaps(data.gaps);
      return data;
    } catch {
      setError({ message: "Network error — try again", retryable: true }); return null;
    } finally { setBusy(false); }
  }

  async function pickTaskType(t: string) { await patch({ taskType: t }); }

  // gaps phase → validate + advance to the summary (NOT straight to generation)
  async function review() {
    const ans: Record<string, string> = { ...answers };
    if (platforms.length) ans.platform = platforms.join(", ");
    const data = await patch({ answers: ans, taskType });
    if (data && data.gaps.length === 0) { setSpec(data.spec); setPhase("summary"); }
  }

  function togglePlatform(p: string) {
    setPlatforms((arr) => (arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]));
  }

  // ── summary phase ──────────────────────────────────────────────────────────
  if (phase === "summary") {
    const specRows = Object.entries(spec).filter(([, v]) => v && v.trim());
    return (
      <section className="editorial-panel rounded-3xl p-5 sm:p-6">
        <p className="editorial-kicker">Confirm</p>
        <h2 className="editorial-title mt-2 text-xl">Here&apos;s what I&apos;ll build</h2>
        <p className="mt-2 text-sm leading-7 editorial-muted">
          A <strong>{recipe?.outputFormat || prettyTask(taskType)}</strong> for <strong>{prettyTask(taskType)}</strong> · {intake.lens} lens.
          Review the brief, then confirm to start generating the copy.
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Task" value={prettyTask(taskType)} />
          <Field label="Pipeline" value={recipe?.group ?? "—"} />
          <Field label="Output" value={recipe?.outputFormat ?? "—"} />
        </dl>

        {specRows.length > 0 && (
          <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--card-2)] p-4">
            <p className="eyebrow">Brief</p>
            <dl className="mt-2 space-y-1.5">
              {specRows.map(([k, v]) => (
                <div key={k} className="flex gap-2 text-sm">
                  <dt className="w-28 shrink-0 mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] pt-0.5">{SPEC_LABELS[k] ?? k}</dt>
                  <dd className="flex-1 text-[var(--foreground)]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-[var(--stop)] bg-[var(--stop-soft)] px-4 py-3 text-sm text-[var(--stop)]">{error.message}</div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={() => setPhase("gaps")} className="editorial-button editorial-button-secondary">← Edit</button>
          <button type="button" onClick={() => onCleared({ recipe, taskType, brief: spec })} className="editorial-button editorial-button-primary">✓ Confirm &amp; generate →</button>
        </div>
      </section>
    );
  }

  // ── gaps phase ─────────────────────────────────────────────────────────────
  return (
    <section className="editorial-panel rounded-3xl p-5 sm:p-6">
      <div className="rounded-2xl bg-[var(--brand-soft)] px-4 py-3">
        <p className="editorial-kicker text-[var(--brand)]">Here&apos;s what I understood</p>
        <p className="mt-1 text-sm font-medium text-[var(--brand-ink)]">{intake.intent || "Your brief"}</p>
        <p className="mt-0.5 mono text-[10px] uppercase tracking-[0.14em] text-[var(--brand)]/70">
          Lens · {intake.lens}{typeof intake.confidence === "number" ? ` · ${Math.round(intake.confidence * 100)}% sure` : ""}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Task" value={prettyTask(taskType)} />
        <Field label="Pipeline" value={recipe?.group ?? "—"} />
        <Field label="Output" value={recipe?.outputFormat ?? "—"} />
      </dl>

      {gaps.length > 0 && (
        <div className="mt-5">
          <p className="eyebrow">I need to know ({gaps.length})</p>
          {taskTypeGap ? (
            <div className="mt-3">
              <p className="text-sm editorial-muted">{questionFor(taskTypeGap)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TASK_TYPES.map((t) => (
                  <button key={t.key} type="button" disabled={busy} onClick={() => pickTaskType(t.key)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${taskType === t.key ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--line-2)] text-[var(--ink-soft)] hover:bg-[var(--card-2)]"}`}>{t.label}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              {fieldGaps.map((g) => (
                <div key={g.field}>
                  <label className="block text-sm font-medium text-[var(--ink-soft)]">
                    {questionFor(g)} {g.required && <span className="text-[var(--stop)]">*</span>}
                  </label>
                  {g.field === "platform" ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {PLATFORMS.map((p) => (
                        <button key={p} type="button" onClick={() => togglePlatform(p)} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${platforms.includes(p) ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--line-2)] text-[var(--ink-soft)] hover:bg-[var(--card-2)]"}`}>{p}</button>
                      ))}
                    </div>
                  ) : (
                    <input type="text" value={answers[g.field] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [g.field]: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[var(--line-2)] bg-[var(--bg-2)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--stop)] bg-[var(--stop-soft)] px-4 py-3 text-sm text-[var(--stop)]">
          <span>{error.message}</span>
          {error.retryable && <button type="button" onClick={review} className="shrink-0 font-semibold underline">Retry</button>}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button type="button" onClick={onBack} className="editorial-button editorial-button-secondary">← Back</button>
        {!taskTypeGap && (
          <button type="button" onClick={review} disabled={busy} className="editorial-button editorial-button-primary disabled:opacity-50">
            {busy ? "Checking…" : "Review →"}
          </button>
        )}
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--card-2)] px-3 py-2">
      <dt className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium capitalize text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function prettyTask(t: string): string {
  return TASK_TYPES.find((x) => x.key === t)?.label ?? (t ? t.replace(/_/g, " ") : "—");
}
