"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { estimateVisual, type ImageSize } from "@/lib/pricing";

// Client-safe copy of the output-type → visual family mapping
// (the server `visual.ts` imports fs, so we don't import it here).
type Kind = "poster" | "storyboard" | "none";
function visualKind(id: string): Kind {
  if (id === "poster") return "poster";
  if (id === "storyboard" || id === "video_script") return "storyboard";
  return "none";
}

type Scene = { no: number; caption: string };
type Stage = "idle" | "planning" | "rendering" | "done" | "skipped" | "error";

// Shape returned by GET /api/jobs?featureRunId=
type JobPayload = {
  jobId: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  resultKind?: string;
  reason?: string | null;
  retryable?: boolean;
  kind?: string;
  image?: { urlPath: string; aspect: string } | null;
  scenes?: Scene[];
  costMyr?: number;
};

const POLL_MS = 2000;
const WORKER_HINT_AFTER = 60; // seconds queued before hinting the worker may be down

export function VisualPanel({ featureRunId, outputTypeId }: { featureRunId: string; outputTypeId: string }) {
  const kind = visualKind(outputTypeId);
  const [stage, setStage] = useState<Stage>("idle");
  const [image, setImage] = useState<{ urlPath: string; aspect: string } | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [cost, setCost] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [retryable, setRetryable] = useState(true);
  const [elapsed, setElapsed] = useState(0); // seconds, live while generating then frozen
  const [queuedTooLong, setQueuedTooLong] = useState(false);
  const startRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }
  function stopTimer() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (startRef.current) setElapsed(Math.round((Date.now() - startRef.current) / 1000));
  }
  function startTimer() {
    startRef.current = Date.now();
    setElapsed(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (startRef.current) setElapsed(Math.round((Date.now() - startRef.current) / 1000));
    }, 500);
  }

  // Map a job payload to panel state. Returns true if terminal (stop polling).
  const applyJob = useCallback((job: JobPayload): boolean => {
    if (job.status === "queued") {
      setStage("planning");
      return false;
    }
    if (job.status === "processing") {
      setStage("rendering");
      setQueuedTooLong(false);
      return false;
    }
    if (job.status === "succeeded") {
      if (job.resultKind === "skipped") {
        setStage("skipped");
      } else {
        setImage(job.image ?? null);
        setScenes(job.scenes ?? []);
        setCost(typeof job.costMyr === "number" ? job.costMyr : null);
        setStage("done");
      }
      window.dispatchEvent(new CustomEvent("generation:complete"));
      return true;
    }
    // failed
    setErrMsg(job.reason || "Gagal jana visual.");
    setRetryable(job.retryable !== false);
    setStage("error");
    return true;
  }, []);

  const pollOnce = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs?featureRunId=${encodeURIComponent(featureRunId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { job: JobPayload | null };
      if (!data.job) return;
      const terminal = applyJob(data.job);
      if (terminal) { stopPoll(); stopTimer(); }
    } catch {
      // transient network error — keep polling
    }
  }, [featureRunId, applyJob]);

  function startPolling() {
    stopPoll();
    pollRef.current = setInterval(pollOnce, POLL_MS);
  }

  // Resume on mount: if an active/recent job exists for this run, restore it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs?featureRunId=${encodeURIComponent(featureRunId)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { job: JobPayload | null };
        if (cancelled || !data.job) return;
        const terminal = applyJob(data.job);
        if (!terminal) { startTimer(); startPolling(); }
      } catch {
        // ignore — user can still submit
      }
    })();
    return () => {
      cancelled = true;
      stopPoll();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureRunId]);

  // Hint that the worker may be down if we've been queued (planning) too long.
  useEffect(() => {
    setQueuedTooLong(stage === "planning" && elapsed >= WORKER_HINT_AFTER);
  }, [stage, elapsed]);

  if (kind === "none") return null;

  const estSize: ImageSize = kind === "poster" ? "1024x1536" : "1536x1024";
  const est = estimateVisual(estSize);
  const whatLabel = kind === "poster" ? "1 poster" : "1 imej storyboard (panel ikut scene)";

  async function generate() {
    setStage("planning");
    setErrMsg("");
    setQueuedTooLong(false);
    startTimer();
    try {
      const res = await fetch("/api/generate/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureRunId }),
      });
      const data = (await res.json()) as { jobId?: string; status?: string; error?: string };
      if (!res.ok) {
        stopTimer();
        setErrMsg(data.error ?? "Gagal hantar job jana visual.");
        setRetryable(true);
        setStage("error");
        return;
      }
      // Enqueued — poll for progress. Worker does the heavy lifting; closing the
      // tab no longer drops the generation.
      startPolling();
      void pollOnce();
    } catch {
      stopTimer();
      setErrMsg("Ralat rangkaian semasa hantar job. Cuba semula.");
      setRetryable(true);
      setStage("error");
    }
  }

  return (
    <div className="editorial-panel rounded-3xl p-5 sm:p-6">
      {/* IDLE */}
      {stage === "idle" && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Visual</p>
            <h2 className="mt-2 text-lg font-semibold text-[#00262a]">Jana visual untuk output ni</h2>
            <p className="mt-1 text-sm text-[#7b8698]">{whatLabel} · brand-aware</p>
          </div>
          <div className="text-right">
            <button
              onClick={generate}
              className="rounded-xl bg-[var(--orange)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--orange-2)]"
            >
              ✨ Jana Visual
            </button>
            <p className="mono mt-2 text-xs text-[#7b8698]">Anggaran ~RM{est.myr.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* PLANNING / RENDERING */}
      {(stage === "planning" || stage === "rendering") && (
        <div className="py-8 text-center">
          <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-[var(--line-2)] border-t-[var(--brand)]" />
          <p className="mt-3 font-semibold text-[#00262a]">
            {stage === "planning" ? "Dalam giliran / AI tengah rancang…" : "Melukis…"}
          </p>
          <p className="mt-1 text-sm text-[#7b8698]">
            {stage === "planning" ? "gpt-4o baca output → tentukan panel & gaya" : "gpt-image-2 · 15–30 saat"}
          </p>
          <p className="mono mt-2 text-base font-bold text-[var(--brand)]">{elapsed}s</p>
          <p className="mt-2 text-xs text-[#7b8698]">Boleh tutup tab — generation jalan di belakang, buka semula bila-bila.</p>
          {queuedTooLong && (
            <p className="mt-2 text-xs text-[#b45309]">
              Lama dalam giliran — pastikan worker hidup (<span className="mono">npm run worker</span>).
            </p>
          )}
        </div>
      )}

      {/* DONE */}
      {stage === "done" && image && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow">Visual · {kind === "poster" ? "Poster" : "Storyboard"}</p>
            <div className="flex items-center gap-2">
              {cost !== null && (
                <span className="rounded-md bg-[var(--ok-soft)] px-2 py-1 mono text-[11px] font-bold text-[var(--ok)]">
                  RM{cost.toFixed(2)}
                </span>
              )}
              {elapsed > 0 && (
                <span className="rounded-md bg-[var(--card-2)] px-2 py-1 mono text-[11px] text-[#7b8698]">
                  ⏱ {elapsed}s
                </span>
              )}
              <button onClick={generate} className="rounded-xl border border-[var(--line-2)] px-3 py-1.5 text-sm font-semibold text-[#33414f] hover:bg-[var(--card-2)]">
                ↻ Regenerate
              </button>
              <a href={image.urlPath} download className="rounded-xl bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--brand-2)]">
                ↓ Download
              </a>
            </div>
          </div>

          <div className="mt-4">
            {/* Native ratio, never cropped — gpt-image-2 outputs 1:1 / 2:3 / 3:2. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.urlPath}
              alt="Generated visual"
              className="rounded-xl border border-[var(--line-2)]"
              style={{
                display: "block",
                height: "auto",
                width: kind === "poster" ? "auto" : "100%",
                maxWidth: kind === "poster" ? "280px" : "100%",
              }}
            />
          </div>

          {kind === "storyboard" && scenes.length > 0 && (
            <div className="mt-4">
              <p className="eyebrow">Scene captions</p>
              <div className="mt-2">
                {scenes.map((s) => (
                  <div key={s.no} className="flex gap-3 border-b border-[var(--line)] py-2 text-[13px] last:border-0">
                    <b className="mono shrink-0 text-[var(--brand)]" style={{ width: 56 }}>Scene {s.no}</b>
                    <span className="text-[#33414f]">{s.caption}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-[#f3d99a] bg-[var(--warn-soft)] p-3 text-xs leading-5 text-[#7a4d06]">
            ⚠ Visual draf — AI tinggalkan ruang untuk logo &amp; teks. Logo, harga &amp; tarikh ditambah oleh designer.
          </div>
        </div>
      )}

      {/* SKIPPED (gpt-4o says no image needed) */}
      {stage === "skipped" && (
        <div className="py-4">
          <p className="eyebrow">Visual</p>
          <p className="mt-2 text-sm text-[#7b8698]">AI rasa output ni tak perlukan visual.</p>
        </div>
      )}

      {/* ERROR */}
      {stage === "error" && (
        <div>
          <p className="eyebrow">Visual</p>
          <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errMsg}</div>
          {retryable ? (
            <button onClick={generate} className="mt-3 rounded-xl border border-[var(--line-2)] px-4 py-2 text-sm font-semibold text-[#33414f] hover:bg-[var(--card-2)]">
              Cuba semula
            </button>
          ) : (
            <p className="mt-3 text-xs text-[#7b8698]">
              Cuba semula takkan membantu — ubah brief/jawapan, jana output baru, kemudian jana visual.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
