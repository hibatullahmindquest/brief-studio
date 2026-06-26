"use client";

import { useEffect, useRef, useState } from "react";
import type { StudioResponse } from "@/lib/router";

// Phase G — Step 1, the front door. Free-text brief + optional attachments + quick-start type
// hints + lens + brand → POST /api/studio. On success it hands the StudioResponse up to the
// orchestrator. English chrome; the brief itself can be any language (the router mirrors it).

type Lens = "marketing" | "social";
type Brand = { id: string; name: string; slug: string; primaryColor: string; secondaryColor: string; tagline: string };
type UploadRef = { path: string; name: string };

const QUICK: { label: string; hint: string }[] = [
  { label: "Poster", hint: "Poster: " },
  { label: "Carousel", hint: "Carousel: " },
  { label: "Copywriting", hint: "Copywriting: " },
  { label: "Marketing plan", hint: "Marketing plan: " },
  { label: "Ideas", hint: "Ideas: " },
];

export function StepDescribe({
  lensOptions, defaultLens, onIntake, seed,
}: { lensOptions: Lens[]; defaultLens: Lens; onIntake: (resp: StudioResponse) => void; seed?: string }) {
  const [text, setText] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandSlug, setBrandSlug] = useState("");
  const [lens, setLens] = useState<Lens>(defaultLens);
  const [uploads, setUploads] = useState<UploadRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/brand")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Brand[]) => {
        setBrands(data);
        if (data.length) setBrandSlug((s) => s || data[0].slug);
      })
      .catch(() => setBrands([]));
  }, []);

  // pre-fill from a "Take it further" chaining click (arrives post-hydration)
  useEffect(() => { if (seed) setText(seed); }, [seed]);

  const canSend = !!brandSlug && (text.trim().length > 0 || uploads.length > 0) && !submitting && !uploading;

  function applyQuick(hint: string) {
    setText((t) => (t.trim() ? t : hint));
    taRef.current?.focus();
  }

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/studio/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError({ message: data.error ?? "Upload failed", retryable: !!data.retryable }); return; }
      setUploads((u) => [...u, { path: data.path, name: data.name }]);
    } catch {
      setError({ message: "Upload failed — try again", retryable: true });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSend() {
    if (!canSend) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandSlug,
          text: text.trim() || undefined,
          uploads: uploads.map((u) => u.path),
          explicitLens: lens,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError({ message: data.error ?? "Something went wrong", retryable: !!data.retryable }); return; }
      onIntake(data as StudioResponse);
    } catch {
      setError({ message: "Network error — try again", retryable: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="editorial-panel rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="editorial-kicker">{seed ? "Continuing from a previous run" : "Front door"}</p>
          <h1 className="editorial-title mt-2 text-2xl sm:text-3xl">What do you want to make?</h1>
        </div>
        {/* lens + brand pickers */}
        <div className="flex flex-col items-end gap-2">
          <LensPicker options={lensOptions} value={lens} onChange={setLens} />
          <BrandPicker brands={brands} value={brandSlug} onChange={setBrandSlug} />
        </div>
      </div>

      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        autoFocus
        placeholder="e.g. Poster promosi kelas tuisyen SPM untuk IG, objektif daftar trial percuma…"
        className="mt-4 w-full resize-y rounded-2xl border border-[var(--line-2)] bg-[var(--bg-2)] px-4 py-3 text-sm leading-7 text-[var(--foreground)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
      />

      {/* quick-start hints */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Quick start</span>
        {QUICK.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => applyQuick(q.hint)}
            className="rounded-full border border-[var(--line-2)] px-3 py-1 text-xs font-medium text-[var(--ink-soft)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* uploads */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.gif"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-2)] px-3 py-1 text-xs font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--card-2)] disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="m21.44 11.05-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
          {uploading ? "Uploading…" : "Upload brief"}
        </button>
        {uploads.map((u, i) => (
          <span key={u.path} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs text-[var(--brand)]">
            <span className="max-w-[140px] truncate">{u.name}</span>
            <button type="button" title="Remove" onClick={() => setUploads((arr) => arr.filter((_, j) => j !== i))} className="opacity-70 hover:opacity-100">✕</button>
          </span>
        ))}
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--stop)] bg-[var(--stop-soft)] px-4 py-3 text-sm text-[var(--stop)]">
          <span>{error.message}</span>
          {error.retryable && (
            <button type="button" onClick={handleSend} className="shrink-0 font-semibold underline">Retry</button>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="editorial-button editorial-button-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Reading…" : "Send →"}
        </button>
      </div>
    </section>
  );
}

function LensPicker({ options, value, onChange }: { options: Lens[]; value: Lens; onChange: (l: Lens) => void }) {
  if (options.length <= 1) {
    return (
      <span className="mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
        Lens · <span className="text-[var(--brand)]">{value}</span>
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1 rounded-full border border-[var(--line-2)] p-0.5">
      <span className="px-2 mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Lens</span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors ${value === o ? "bg-[var(--brand)] text-white" : "text-[var(--ink-soft)] hover:bg-[var(--card-2)]"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function BrandPicker({ brands, value, onChange }: { brands: Brand[]; value: string; onChange: (slug: string) => void }) {
  if (brands.length === 0) return <span className="text-xs text-[var(--muted)]">Loading brands…</span>;
  return (
    <div className="flex items-center gap-1.5">
      {brands.map((b) => (
        <button
          key={b.slug}
          type="button"
          onClick={() => onChange(b.slug)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${value === b.slug ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--line-2)] text-[var(--ink-soft)] hover:bg-[var(--card-2)]"}`}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.primaryColor || "var(--brand)" }} />
          {b.name}
        </button>
      ))}
    </div>
  );
}
