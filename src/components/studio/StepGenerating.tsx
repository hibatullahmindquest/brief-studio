"use client";

import { useEffect, useRef, useState } from "react";
import type { RunArtifacts } from "@/lib/artifact-store";

// Phase G — Step 4. On mount it confirms (enqueues the recipe job, idempotent on runId) then
// polls the recipe job status until terminal. Success → loads the grouped artifacts and hands
// them up. Text-first flow: the job writes COPY only (the image is rendered on demand from the
// Result), so the checklist shows the text experts. A live elapsed timer makes it unambiguous
// that work is in progress. The checklist is a best-effort estimate (status is job-level).

type Phase = "confirming" | "running" | "failed" | "timeout";
const POLL_MS = 1500;
const MAX_POLLS = 80; // ~120s before we stop polling and point the user at Recent
const STAGE_MS = 4500; // cosmetic stage advance

const STAGES = ["Strategist", "Copywriter", "Art Director", "Brand Guardian QA"];

export function StepGenerating({
  runId, onDone, onBack,
}: { runId: string; onDone: (a: RunArtifacts) => void; onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("confirming");
  const [stageIdx, setStageIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0); // seconds since confirm
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const stages = STAGES;

  // keep the latest onDone without re-running the confirm/poll effect
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  // live elapsed timer while in progress
  useEffect(() => {
    const running = phase === "confirming" || phase === "running";
    if (!running) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // cosmetic stage advance while running (stops one short of the end until success)
  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => setStageIdx((i) => Math.min(i + 1, stages.length - 1)), STAGE_MS);
    return () => clearInterval(t);
  }, [phase, stages.length]);

  // confirm → poll. Re-runs when retryNonce bumps. Each run owns an `active` flag so React
  // strict-mode's double-mount (and unmount) can't leave a stray poller running.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const setIf = (fn: () => void) => { if (active) fn(); };

    async function confirmAndPoll() {
      setIf(() => { setPhase("confirming"); setError(null); setStageIdx(0); setNotices([]); setElapsed(0); });
      try {
        const res = await fetch(`/api/studio/${runId}/confirm`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) { setIf(() => { setPhase("failed"); setError({ message: data.error ?? "Couldn't start generation", retryable: !!data.retryable }); }); return; }
        setIf(() => setPhase("running"));
        loop(0);
      } catch {
        setIf(() => { setPhase("failed"); setError({ message: "Network error — try again", retryable: true }); });
      }
    }

    function loop(attempt: number) {
      if (!active) return;
      if (attempt >= MAX_POLLS) { setIf(() => setPhase("timeout")); return; }
      timer = setTimeout(async () => {
        if (!active) return;
        try {
          const res = await fetch(`/api/studio/${runId}/status`);
          const data = await res.json().catch(() => ({}));
          if (!active) return;
          if (res.ok) {
            if (Array.isArray(data.notices)) setIf(() => setNotices(data.notices));
            if (data.status === "succeeded") { void finish(); return; }
            if (data.status === "failed") { setIf(() => { setPhase("failed"); setError({ message: data.reason ?? "Generation failed", retryable: !!data.retryable }); }); return; }
          }
          loop(attempt + 1); // transient/non-terminal → keep polling
        } catch {
          loop(attempt + 1);
        }
      }, POLL_MS);
    }

    async function finish() {
      setIf(() => setStageIdx(stages.length));
      try {
        const res = await fetch(`/api/studio/${runId}`);
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) { setIf(() => { setPhase("failed"); setError({ message: "Generated, but couldn't load the result", retryable: true }); }); return; }
        onDoneRef.current(data as RunArtifacts);
      } catch {
        setIf(() => { setPhase("failed"); setError({ message: "Couldn't load the result", retryable: true }); });
      }
    }

    confirmAndPoll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [runId, retryNonce, stages.length]);

  const running = phase === "confirming" || phase === "running";

  return (
    <section className="editorial-panel rounded-3xl p-5 sm:p-6">
      <div className="flex items-center gap-3">
        {running && <Spinner />}
        <div className="flex-1">
          <p className="editorial-kicker">{phase === "confirming" ? "Starting" : phase === "running" ? "Generating" : phase === "timeout" ? "Still running" : "Generation failed"}</p>
          <h2 className="editorial-title mt-1 text-xl">
            {running ? "Your experts are working…" : phase === "timeout" ? "Taking longer than usual" : "Something went wrong"}
          </h2>
        </div>
        {(running || phase === "timeout") && (
          <span className="shrink-0 rounded-full bg-[var(--card-2)] px-3 py-1 mono text-sm font-semibold tabular-nums text-[var(--foreground)]" aria-label="Elapsed time">
            {fmt(elapsed)}
          </span>
        )}
      </div>

      {phase !== "failed" && (
        <ol className="mt-5 space-y-2">
          {stages.map((s, i) => {
            const done = i < stageIdx;
            const now = i === stageIdx && running;
            return (
              <li key={s} className="flex items-center gap-2.5 text-sm">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${done ? "bg-[var(--ok)] text-white" : now ? "bg-[var(--brand)] text-white" : "bg-[var(--card-2)] text-[var(--muted)]"}`}>
                  {done ? "✓" : now ? "•" : i + 1}
                </span>
                <span className={done ? "text-[var(--foreground)]" : now ? "font-medium text-[var(--foreground)]" : "text-[var(--muted)]"}>{s}</span>
                {now && <span className="ml-1"><Spinner small /></span>}
              </li>
            );
          })}
        </ol>
      )}

      {running && (
        <p className="mt-4 text-xs editorial-muted">You can leave this page — the work continues, and it&apos;ll appear in Recent when done.</p>
      )}

      {notices.length > 0 && (
        <ul className="mt-4 space-y-1">
          {notices.map((n, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--warn)]">
              <span aria-hidden>⚠</span><span>{n}</span>
            </li>
          ))}
        </ul>
      )}

      {phase === "timeout" && (
        <p className="mt-4 text-sm editorial-muted">It&apos;s still generating on the server. Open <strong>Recent</strong> (top-right) in a moment to see the result.</p>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-[var(--stop)] bg-[var(--stop-soft)] px-4 py-3 text-sm text-[var(--stop)]">{error.message}</div>
      )}

      {(phase === "failed" || phase === "timeout") && (
        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={onBack} className="editorial-button editorial-button-secondary">← Back</button>
          {(phase === "timeout" || error?.retryable) && (
            <button type="button" onClick={() => setRetryNonce((n) => n + 1)} className="editorial-button editorial-button-primary">Retry</button>
          )}
        </div>
      )}
    </section>
  );
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

function Spinner({ small }: { small?: boolean }) {
  const size = small ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <svg className={`${size} animate-spin text-[var(--brand)]`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7Z" />
    </svg>
  );
}
