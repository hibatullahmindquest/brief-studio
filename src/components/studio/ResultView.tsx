"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RunArtifacts, ArtifactRow } from "@/lib/artifact-store";
import { fixBrandCase, stripMarkdownBold } from "@/lib/copy-format";

// Phase G — Step 5 result, shared by the live flow and the deep-link /studio/[runId] page.
// Text-first flow: copy is shown first; for image-capable runs a "Generate poster" panel renders
// the image on demand (renderFromRun via POST /render). Also shows the Brand Guardian verdict
// (contextUsed), per-run cost, time taken, and actions (regenerate / export / feedback). Holds
// the artifacts in state so generate/export refresh in place.

type GuardianVerdict = { verdict?: "pass" | "flag" | "retry" | "skipped"; reasons?: string[]; retried?: boolean };
type Ctx = { guardian?: GuardianVerdict; grounding?: { lens?: string }; notices?: string[] } | null;
type Ratio = "auto" | "9:16" | "1:1" | "16:9";

const textOf = (a: ArtifactRow) => ((a.content as { text?: unknown } | null)?.text ?? "").toString();
const ratioOf = (a: ArtifactRow) => ((a.content as { ratio?: unknown } | null)?.ratio ?? "").toString();
const TYPE_LABEL: Record<string, string> = { strategy: "Strategy", copy: "Copy", social: "Caption", text: "Text" };

function fmtDur(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function ResultView({ runId, initial }: { runId: string; initial: RunArtifacts }) {
  const [art, setArt] = useState<RunArtifacts>(initial);
  const [imgIdx, setImgIdx] = useState(0);
  const [busy, setBusy] = useState<"render" | "export" | null>(null);
  const [renderSecs, setRenderSecs] = useState(0);
  const [toast, setToast] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [fbBusy, setFbBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState(initial.run.feedbackNote ?? "");

  const ctx = art.contextUsed as Ctx;
  const guardian = ctx?.guardian;
  const lens = ctx?.grounding?.lens ?? art.run.feature;
  const notices = ctx?.notices ?? [];
  const hasImages = art.images.length > 0;
  const hasText = art.texts.length > 0;

  // stop touching state if the user leaves mid-render (the worker finishes regardless — that's
  // the point of the async render; the result shows up in Recent).
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // live timer while the on-demand image render is in flight
  useEffect(() => {
    if (busy !== "render") return;
    setRenderSecs(0);
    const t = setInterval(() => setRenderSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  async function refetch() {
    const res = await fetch(`/api/studio/${runId}`);
    if (res.ok && mounted.current) setArt((await res.json()) as RunArtifacts);
  }

  // per-run 👍/👎. Optimistic (revert on error). value 0 = clear; a note rides on a -1.
  async function postFeedback(value: number, note?: string) {
    const prev = { feedback: art.run.feedback, feedbackNote: art.run.feedbackNote };
    setArt((a) => ({ ...a, run: { ...a.run, feedback: value === 0 ? null : value, feedbackNote: value === -1 ? (note ?? a.run.feedbackNote ?? null) : null } }));
    setFbBusy(true);
    try {
      const res = await fetch(`/api/studio/${runId}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value, note }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "save failed");
      if (mounted.current) setArt((a) => ({ ...a, run: { ...a.run, feedback: d.feedback, feedbackNote: d.feedbackNote } }));
    } catch {
      if (mounted.current) { setArt((a) => ({ ...a, run: { ...a.run, ...prev } })); setToast({ kind: "warn", text: "Couldn't save feedback — try again." }); }
    } finally {
      if (mounted.current) setFbBusy(false);
    }
  }

  // toggle: clicking the active thumb clears it
  function toggleThumb(v: 1 | -1) {
    const next = art.run.feedback === v ? 0 : v;
    void postFeedback(next, next === -1 ? noteDraft : undefined);
  }

  // poll the render job to completion (async — the worker does the work). Returns the terminal
  // status payload, or null on client-side timeout (the render keeps going server-side).
  async function pollRender(): Promise<{ status: string; resultKind?: string; reason?: string } | null> {
    for (let i = 0; i < 80; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      if (!mounted.current) return null;
      try {
        const res = await fetch(`/api/studio/${runId}/status`);
        const d = await res.json().catch(() => ({}));
        if (res.ok && (d.status === "succeeded" || d.status === "failed")) return d;
      } catch { /* transient — keep polling */ }
    }
    return null;
  }

  async function render(ratio?: Exclude<Ratio, "auto">) {
    setBusy("render"); setToast(null);
    try {
      const res = await fetch(`/api/studio/${runId}/render`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ratio ? { ratio } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { if (mounted.current) setToast({ kind: "warn", text: data.error ?? "Couldn't start the render — try again." }); return; }

      const done = await pollRender();
      if (!mounted.current) return;
      if (!done) { setToast({ kind: "warn", text: "Still generating — check Recent in a moment." }); return; }
      if (done.status === "failed") { setToast({ kind: "warn", text: done.reason ?? "Image generation failed — try again." }); return; }
      if (done.resultKind === "skipped") { setToast({ kind: "warn", text: "Nothing to generate — this run has no visual direction." }); return; }
      await refetch();
      if (mounted.current) { setImgIdx(0); setToast({ kind: "ok", text: "Poster generated." }); }
    } catch {
      if (mounted.current) setToast({ kind: "warn", text: "Network error — try again." });
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy("export"); setToast(null);
    try {
      const res = await fetch(`/api/studio/${runId}/export`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.skipped) { setToast({ kind: "warn", text: "Nothing to export — no text in this run." }); return; }
      if (!res.ok) { setToast({ kind: "warn", text: data.error ?? "Export failed — try again." }); return; }
      await refetch();
      setToast({ kind: "ok", text: "PDF ready — download below." });
    } catch {
      setToast({ kind: "warn", text: "Network error — try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="editorial-panel rounded-3xl p-5 sm:p-6">
      {/* header: QA verdict + meta */}
      <div className="flex flex-wrap items-center gap-2">
        <GuardianPill guardian={guardian} lens={lens} />
        <Badge>Done</Badge>
        <Badge>RM {art.costMyr.toFixed(2)}</Badge>
        {art.durationMs != null && <Badge>⏱ {fmtDur(art.durationMs)}</Badge>}
        {hasImages && ratioOf(art.images[imgIdx]) && <Badge>{ratioOf(art.images[imgIdx])}</Badge>}
      </div>

      {/* image first when one exists — see the poster before the copy */}
      {hasImages && (
        <div className="mt-4">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-2)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art.images[imgIdx].mediaPath ?? ""} alt="Generated visual" className="mx-auto max-h-[460px] w-auto object-contain" />
            {art.images.length > 1 && (
              <>
                <CarouselBtn dir="prev" onClick={() => setImgIdx((i) => (i - 1 + art.images.length) % art.images.length)} />
                <CarouselBtn dir="next" onClick={() => setImgIdx((i) => (i + 1) % art.images.length)} />
              </>
            )}
          </div>
          {art.images.length > 1 && (
            <div className="mt-2 flex justify-center gap-1.5">
              {art.images.map((_, i) => (
                <button key={i} type="button" onClick={() => setImgIdx(i)} aria-label={`Image ${i + 1}`} className={`h-1.5 rounded-full transition-all ${i === imgIdx ? "w-5 bg-[var(--brand)]" : "w-1.5 bg-[var(--line-2)]"}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* copy (below the image when there is one; first for text-only / pre-render) */}
      {hasText && (
        <div className="mt-4 space-y-3">
          {art.texts.map((t) => (
            <CopyBlock key={t.id} label={TYPE_LABEL[t.type] ?? t.type} text={fixBrandCase(textOf(t), art.run.brandName)} />
          ))}
        </div>
      )}

      {/* on-demand generate — only while no image has been rendered yet (text-first review) */}
      {!hasImages && art.imageable && (
        <GeneratePosterPanel busy={busy === "render"} secs={renderSecs} onGenerate={render} />
      )}

      {/* guardian reasons + notices */}
      {(guardian?.reasons?.length || notices.length > 0) && (
        <div className="mt-4 space-y-1">
          {guardian?.verdict !== "pass" && guardian?.reasons?.map((r, i) => (
            <p key={`g${i}`} className="flex items-start gap-1.5 text-xs text-[var(--warn)]"><span aria-hidden>⚠</span><span>{r}</span></p>
          ))}
          {notices.map((n, i) => (
            <p key={`n${i}`} className="flex items-start gap-1.5 text-xs editorial-muted"><span aria-hidden>·</span><span>{n}</span></p>
          ))}
        </div>
      )}

      {/* prominent in-progress banner for ↻ Variation (the first render uses GeneratePosterPanel) */}
      {busy === "render" && hasImages && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--orange)] bg-[var(--orange-soft)] px-4 py-3">
          <RenderSpinner />
          <p className="flex-1 text-sm font-semibold text-[var(--orange-2)]">Regenerating poster… you can leave; it&apos;ll update in Recent.</p>
          <span className="shrink-0 mono text-sm font-bold tabular-nums text-[var(--orange-2)]">{renderSecs}s</span>
        </div>
      )}

      {toast && (
        <div className={`mt-4 rounded-xl px-4 py-2.5 text-sm ${toast.kind === "ok" ? "bg-[var(--ok-soft)] text-[var(--ok)]" : "bg-[var(--warn-soft)] text-[var(--warn)]"}`}>{toast.text}</div>
      )}

      {/* actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
        <FeedbackButtons feedback={art.run.feedback} busy={fbBusy} onThumb={toggleThumb} />
        {hasImages && (
          <button type="button" onClick={() => render()} disabled={busy !== null} className="editorial-button editorial-button-secondary disabled:opacity-50">
            {busy === "render" ? "Regenerating…" : "↻ Variation"}
          </button>
        )}
        {hasText && (
          art.pdf?.mediaPath ? (
            <a href={art.pdf.mediaPath} download className="editorial-button editorial-button-secondary">⬇ Download PDF</a>
          ) : (
            <button type="button" onClick={exportPdf} disabled={busy !== null} className="editorial-button editorial-button-secondary disabled:opacity-50">
              {busy === "export" ? "Exporting…" : "Export PDF"}
            </button>
          )
        )}
      </div>

      {/* optional note on a thumbs-down */}
      {art.run.feedback === -1 && (
        <input
          type="text"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => { if ((noteDraft.trim() || null) !== (art.run.feedbackNote ?? null)) void postFeedback(-1, noteDraft); }}
          placeholder="Optional: what missed? (brand, tone, accuracy…)"
          aria-label="Feedback note"
          className="mt-2 w-full rounded-xl border border-[var(--line-2)] bg-[var(--bg-2)] px-3 py-2 text-sm outline-none focus:border-[var(--stop)] focus:ring-2 focus:ring-[var(--stop-soft)]"
        />
      )}

      <ChainingOffer runId={runId} taskType={art.run.feature} texts={art.texts} />
    </section>
  );
}

function GeneratePosterPanel({ busy, secs, onGenerate }: { busy: boolean; secs: number; onGenerate: (ratio?: Exclude<Ratio, "auto">) => void }) {
  const [ratio, setRatio] = useState<Ratio>("auto");
  const RATIOS: { key: Ratio; label: string }[] = [
    { key: "auto", label: "Auto" }, { key: "9:16", label: "9:16" }, { key: "1:1", label: "1:1" }, { key: "16:9", label: "16:9" },
  ];

  // prominent in-progress state — a 30s render with only a button label is too easy to miss.
  if (busy) {
    return (
      <div className="mt-4 rounded-2xl border border-[var(--orange)] bg-[var(--orange-soft)] p-5">
        <div className="flex items-center gap-3">
          <RenderSpinner />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--orange-2)]">Generating your poster…</p>
            <p className="text-xs text-[var(--orange-2)]/80">Usually ~20–40s. You can leave — it&apos;ll appear in Recent when done.</p>
          </div>
          <span className="shrink-0 rounded-full bg-white/70 px-3 py-1 mono text-sm font-bold tabular-nums text-[var(--orange-2)]" aria-label="Elapsed">{secs}s</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/50">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--orange)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-dashed border-[var(--line-2)] bg-[var(--bg-2)] p-4">
      <p className="eyebrow">Poster</p>
      <p className="mt-1 text-sm editorial-muted">Happy with the copy? Generate the poster image from it — logo &amp; footer are stamped automatically.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-[var(--line-2)] p-0.5">
          {RATIOS.map((r) => (
            <button key={r.key} type="button" onClick={() => setRatio(r.key)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${ratio === r.key ? "bg-[var(--brand)] text-white" : "text-[var(--ink-soft)] hover:bg-[var(--card-2)]"}`}>{r.label}</button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onGenerate(ratio === "auto" ? undefined : ratio)}
          className="editorial-button"
          style={{ background: "var(--orange)", color: "#fff" }}
        >
          🖼 Generate poster
        </button>
      </div>
    </div>
  );
}

function RenderSpinner() {
  return (
    <svg className="h-6 w-6 animate-spin text-[var(--orange-2)]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7Z" />
    </svg>
  );
}

function GuardianPill({ guardian, lens }: { guardian?: GuardianVerdict; lens: string }) {
  const v = guardian?.verdict;
  const onBrand = v === "pass";
  const skipped = v === "skipped" || !v;
  const cls = onBrand ? "bg-[var(--ok-soft)] text-[var(--ok)]" : skipped ? "bg-[var(--card-2)] text-[var(--muted)]" : "bg-[var(--warn-soft)] text-[var(--warn)]";
  const label = onBrand ? "On-brand" : skipped ? "QA skipped" : "Needs review";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize ${cls}`}>
      {onBrand ? "✓" : skipped ? "—" : "!"} {label} · {lens}
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[var(--card-2)] px-2.5 py-1 mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">{children}</span>;
}

function CarouselBtn({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={dir} className={`absolute top-1/2 ${dir === "prev" ? "left-2" : "right-2"} -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[var(--foreground)] shadow hover:bg-white`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">{dir === "prev" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}</svg>
    </button>
  );
}

// render inline **bold** as <strong>; everything else stays plain (newlines via pre-wrap).
function renderRich(text: string) {
  return text.split(/(\*\*[^*]+?\*\*)/g).map((seg, i) => {
    const m = /^\*\*([^*]+?)\*\*$/.exec(seg);
    return m ? <strong key={i}>{m[1]}</strong> : <span key={i}>{seg}</span>;
  });
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    // copy clean text (no markdown markers)
    try { await navigator.clipboard.writeText(stripMarkdownBold(text)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  }
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--card-2)] p-3.5">
      <div className="flex items-center justify-between">
        <p className="mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
        <button type="button" onClick={copy} className="text-[11px] font-medium text-[var(--brand)] hover:underline">{copied ? "Copied ✓" : "Copy"}</button>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)]">{renderRich(text)}</p>
    </div>
  );
}

function FeedbackButtons({ feedback, busy, onThumb }: { feedback: number | null; busy: boolean; onThumb: (v: 1 | -1) => void }) {
  return (
    <div className="flex items-center gap-1">
      {([1, -1] as const).map((v) => {
        const active = feedback === v;
        const up = v === 1;
        return (
          <button
            key={v}
            type="button"
            disabled={busy}
            aria-pressed={active}
            aria-label={up ? "Good result" : "Needs work"}
            onClick={() => onThumb(v)}
            className={`grid h-9 w-9 place-items-center rounded-full border text-sm transition-colors disabled:opacity-50 ${
              active
                ? up ? "border-[var(--ok)] bg-[var(--ok-soft)]" : "border-[var(--stop)] bg-[var(--stop-soft)]"
                : "border-[var(--line-2)] hover:bg-[var(--card-2)]"
            }`}
          >
            {up ? "👍" : "👎"}
          </button>
        );
      })}
    </div>
  );
}

// "Take it further" — light pre-fill chaining. Offers the OTHER enabled recipes; clicking stashes
// this run's copy + the target type in sessionStorage and opens the front door pre-filled.
const CHAIN_TARGETS: { type: string; label: string }[] = [
  { type: "poster", label: "Make a poster" },
  { type: "caption", label: "Write captions" },
  { type: "marketing_plan", label: "Marketing plan" },
];

function ChainingOffer({ runId, taskType, texts }: { runId: string; taskType: string; texts: ArtifactRow[] }) {
  const router = useRouter();
  const seedText = texts.map(textOf).filter(Boolean).join("\n\n").trim();
  if (!seedText) return null; // nothing to carry forward
  const targets = CHAIN_TARGETS.filter((t) => t.type !== taskType);
  if (targets.length === 0) return null;

  function go(type: string) {
    try { sessionStorage.setItem("studio:seed", JSON.stringify({ text: seedText, type, fromRunId: runId })); } catch { /* private mode — fall through */ }
    router.push("/studio");
  }

  return (
    <div className="mt-4">
      <p className="eyebrow">Take it further</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {targets.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => go(t.type)}
            className="rounded-full border border-[var(--line-2)] px-3 py-1 text-xs font-medium text-[var(--ink-soft)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
          >
            {t.label} →
          </button>
        ))}
      </div>
    </div>
  );
}
