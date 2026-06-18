"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { VisualPanel } from "./VisualPanel";
import type { BrandSummary } from "./StudioWizard";

// Client mirror of VisualSpec (server type lives in visual.ts which imports fs).
type VisualSpec = {
  brief: string;
  angle: string;
  objective: string;
  style: string;
  mood: string;
  headline: string;
  accent: string;
  cta: string;
  concept: string;
  ratio: "1:1" | "9:16" | "16:9";
  styleOptions: string[];
  moodOptions: string[];
};

type Phase = "brief" | "spec" | "generate";
type TextField = "headline" | "accent" | "cta";

const OBJECTIVES = [
  { key: "Pendaftaran", label: "Pendaftaran" },
  { key: "Awareness", label: "Awareness" },
  { key: "Event / Promo", label: "Event / promo" },
  { key: "", label: "Biar AI decide" },
];

const RATIOS: { value: VisualSpec["ratio"]; label: string }[] = [
  { value: "9:16", label: "IG Story · 9:16" },
  { value: "1:1", label: "Feed · 1:1" },
  { value: "16:9", label: "Banner · 16:9" },
];

function ratioLabel(r: string): string {
  return RATIOS.find((x) => x.value === r)?.label ?? r;
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

export function GuidedPosterFlow({
  brand,
  initialRunId = null,
  onExit,
}: {
  brand: BrandSummary;
  initialRunId?: string | null;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("brief");
  const [brief, setBrief] = useState("");
  const [objective, setObjective] = useState<string>("Pendaftaran");
  const [runId, setRunId] = useState<string | null>(initialRunId);
  const [spec, setSpec] = useState<VisualSpec | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [regenField, setRegenField] = useState<TextField | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Load an existing Draft for editing (from Semakan Lepas "Edit") ──────────
  useEffect(() => {
    if (!initialRunId) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/studio/visual-spec?featureRunId=${encodeURIComponent(initialRunId)}`);
        const data = (await res.json()) as { spec?: VisualSpec | null; status?: string };
        if (cancelled) return;
        if (res.ok && data.spec) {
          setSpec(data.spec);
          setBrief(data.spec.brief ?? "");
          setObjective(data.spec.objective ?? "");
          setConfirmed(data.status === "confirmed");
          setPhase("spec");
        } else {
          setError("Tak jumpa draft ni. Mula brief baru.");
        }
      } catch {
        if (!cancelled) setError("Gagal muat draft.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialRunId]);

  // Editing any spec field locally must re-gate Generate behind a fresh Sahkan.
  const patchSpec = useCallback((patch: Partial<VisualSpec>) => {
    setSpec((s) => (s ? { ...s, ...patch } : s));
    setConfirmed(false);
  }, []);

  function composeBrief(): string {
    const parts = [brief.trim()];
    if (objective) parts.push(`Objektif: ${objective}.`);
    return parts.filter(Boolean).join(" ");
  }

  // ── Synthesise the Creative Spec from the free-text brief ───────────────────
  async function synthesize() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/visual-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featureRunId: runId ?? undefined,
          brandSlug: brand.slug,
          brief: composeBrief(),
        }),
      });
      const data = (await res.json()) as { featureRunId?: string; spec?: VisualSpec; error?: string };
      if (!res.ok || !data.spec) {
        setError(data.error ?? "Gagal sediakan spec. Cuba semula.");
        return;
      }
      setRunId(data.featureRunId ?? runId);
      setSpec(data.spec);
      setConfirmed(false);
      setPhase("spec");
      // Draft now saved → refresh Semakan Lepas so it appears immediately.
      window.dispatchEvent(new CustomEvent("generation:start"));
    } catch {
      setError("Ralat rangkaian. Cuba semula.");
    } finally {
      setBusy(false);
    }
  }

  // ── Regenerate a single text field (↻ Jana semula) ──────────────────────────
  async function regenerate(field: TextField) {
    if (!runId || busy || regenField) return;
    setRegenField(field);
    setError(null);
    try {
      const res = await fetch("/api/studio/regenerate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureRunId: runId, field }),
      });
      const data = (await res.json()) as { field?: TextField; value?: string; error?: string };
      if (res.ok && typeof data.value === "string") {
        patchSpec({ [field]: data.value } as Partial<VisualSpec>);
      } else {
        setError(data.error ?? "Gagal jana semula.");
      }
    } catch {
      setError("Ralat rangkaian semasa jana semula.");
    } finally {
      setRegenField(null);
    }
  }

  // ── Sahkan Idea: persist all edits, then confirm (gates Generate) ───────────
  async function confirm() {
    if (!runId || !spec || busy) return;
    setBusy(true);
    setError(null);
    try {
      const save = await fetch("/api/studio/visual-spec", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureRunId: runId, patch: spec }),
      });
      if (!save.ok) {
        const d = (await save.json()) as { error?: string };
        setError(d.error ?? "Gagal simpan spec.");
        return;
      }
      const res = await fetch("/api/studio/confirm-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureRunId: runId }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Gagal sahkan idea.");
        return;
      }
      setConfirmed(true);
    } catch {
      setError("Ralat rangkaian semasa sahkan.");
    } finally {
      setBusy(false);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────

  if (phase === "generate" && runId) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setPhase("spec")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#7b8698] hover:text-[#00262a]"
        >
          ← Kembali ke Spec
        </button>
        <VisualPanel featureRunId={runId} outputTypeId="poster" autoStart />
        <button
          onClick={onExit}
          className="text-sm font-medium text-[#7b8698] hover:text-[#00262a]"
        >
          + Poster baru
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── BRIEF STAGE ───────────────────────────────────────────────────── */}
      {phase === "brief" && (
        <div className="editorial-panel rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Brief berpandu · poster</p>
              <h2 className="mt-2 text-lg font-semibold text-[#00262a]">Cerita ringkas — poster apa yang awak nak?</h2>
              <p className="mt-1 text-sm text-[#7b8698]">
                Objektif, <b>angle/occasion</b>, nak guna kat mana. Taip bebas — AI tulis copy dari angle awak.
              </p>
            </div>
            <button onClick={onExit} className="shrink-0 text-sm text-[#7b8698] hover:text-[#00262a]">✕ Tukar output</button>
          </div>

          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder="Contoh: Poster promosi kelas, angle cuti sekolah, untuk IG Story"
            className="mt-4 w-full resize-none rounded-xl border border-[var(--line-2)] bg-white px-4 py-3 text-sm text-[#00262a] placeholder-[#a6aebb] outline-none transition focus:border-[var(--brand)]"
          />

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#7b8698]">Objektif</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {OBJECTIVES.map((o) => (
              <button
                key={o.label}
                onClick={() => setObjective(o.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  objective === o.key
                    ? "border-[var(--brand)] bg-[var(--brand-soft)] text-foreground"
                    : "border-[var(--line-2)] text-[#7b8698] hover:bg-[var(--card-2)]"
                }`}
              >
                {o.key === "" ? "✦ " : ""}{o.label}
              </button>
            ))}
          </div>

          {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={synthesize}
              disabled={busy || !brief.trim()}
              className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-2)] disabled:opacity-40"
            >
              {busy ? "✦ Menyiapkan…" : "✦ Sediakan Creative Spec"}
            </button>
            <span className="text-xs text-[#a6aebb]">Format auto-detect dari brief (cth: IG Story → 9:16)</span>
          </div>
        </div>
      )}

      {/* ── SPEC STAGE ────────────────────────────────────────────────────── */}
      {phase === "spec" && spec && (
        <>
          {/* Understanding + brief panel */}
          <div className="editorial-panel rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-start gap-5">
              <div className="min-w-[280px] flex-1">
                <p className="eyebrow">Faham ✓</p>
                <p className="mt-2 text-sm leading-6 text-[#33414f]">
                  <b>Objektif:</b> {spec.objective || "—"} · <b>Angle:</b>{" "}
                  <span className="text-[var(--orange)]">{spec.angle || "—"}</span> · <b>Format:</b> {ratioLabel(spec.ratio)}.
                  AI akan tulis headline &amp; CTA dari angle ni.
                </p>

                {/* Gaya chips */}
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#7b8698]">Gaya</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {uniq([spec.style, ...spec.styleOptions]).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => patchSpec({ style: opt })}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        spec.style === opt
                          ? "border-[var(--brand)] bg-[var(--brand-soft)] text-foreground"
                          : "border-[var(--line-2)] text-[#7b8698] hover:bg-[var(--card-2)]"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                  <CustomChip label="Tulis sendiri" onSet={(v) => patchSpec({ style: v })} />
                </div>

                {/* Mood chips */}
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#7b8698]">Mood</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {uniq([spec.mood, ...spec.moodOptions]).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => patchSpec({ mood: opt })}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        spec.mood === opt
                          ? "border-[var(--brand)] bg-[var(--brand-soft)] text-foreground"
                          : "border-[var(--line-2)] text-[#7b8698] hover:bg-[var(--card-2)]"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                  <CustomChip label="Tulis sendiri" onSet={(v) => patchSpec({ mood: v })} />
                </div>
              </div>

              {/* Brief setakat ini */}
              <div className="w-full rounded-2xl border border-[var(--line)] bg-[var(--card-2)] p-4 sm:w-[210px]">
                <p className="flex items-center gap-2 text-xs font-semibold text-[#00262a]">
                  <span className="inline-block h-2 w-2 rounded-full bg-[var(--brand)]" /> Brief setakat ini
                </p>
                <BriefRow k="Objektif" v={spec.objective || "—"} />
                <BriefRow k="Angle" v={spec.angle || "—"} accent />
                <BriefRow k="Format" v={ratioLabel(spec.ratio)} />
                <BriefRow k="Gaya" v={spec.style || "—"} />
                <BriefRow k="Mood" v={spec.mood || "—"} />
                <BriefRow k="Warna brand" v="auto ✓" last />
              </div>
            </div>
          </div>

          {/* Creative Spec card */}
          <div className="editorial-panel rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-[#00262a]">✦ Creative Spec</h3>
              <span className="rounded-md bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--brand)]">
                Semak &amp; edit sebelum generate
              </span>
            </div>
            <p className="mt-1 text-xs text-[#7b8698]">
              <b>Perkataan tepat</b> di sini ialah yang ditulis atas poster — gpt-image-2 cuma susun atur &amp; gaya huruf.
            </p>

            {/* Text-in-poster box */}
            <div className="mt-4 rounded-xl border border-dashed border-[var(--brand)] bg-[var(--brand-soft)] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--brand)]">📝 Teks dalam poster — perkataan tepat</p>
              <div className="mt-3 space-y-2">
                {(["headline", "accent", "cta"] as TextField[]).map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <span className="w-[58px] shrink-0 text-[10px] font-semibold uppercase text-[#7b8698]">{field}</span>
                    <input
                      value={spec[field]}
                      onChange={(e) => patchSpec({ [field]: e.target.value } as Partial<VisualSpec>)}
                      className="min-w-0 flex-1 rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm text-[#00262a] outline-none focus:border-[var(--brand)]"
                    />
                    <span className="hidden shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand)] sm:inline">✦ AI</span>
                    <button
                      onClick={() => regenerate(field)}
                      disabled={!!regenField}
                      className="shrink-0 rounded-lg border border-[var(--line-2)] px-2 py-1.5 text-xs font-medium text-[#33414f] transition hover:bg-[var(--card-2)] disabled:opacity-40"
                    >
                      {regenField === field ? "↻ …" : "↻ Jana semula"}
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[#7b8698]">
                Edit sendiri, atau tekan <b>↻ Jana semula</b>. Poster guna perkataan ini <b>verbatim</b>. Kosongkan = tiada teks.
              </p>
            </div>

            {/* Spec table */}
            <div className="mt-4 space-y-3">
              <SpecField label="Angle">
                <input
                  value={spec.angle}
                  onChange={(e) => patchSpec({ angle: e.target.value })}
                  className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm text-[#00262a] outline-none focus:border-[var(--brand)]"
                />
              </SpecField>
              <SpecField label="Konsep">
                <textarea
                  value={spec.concept}
                  onChange={(e) => patchSpec({ concept: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm text-[#00262a] outline-none focus:border-[var(--brand)]"
                />
              </SpecField>
              <SpecField label="Ratio">
                <div className="flex flex-wrap gap-2">
                  {RATIOS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => patchSpec({ ratio: r.value })}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        spec.ratio === r.value
                          ? "border-[var(--brand)] bg-[var(--brand-soft)] text-foreground"
                          : "border-[var(--line-2)] text-[#7b8698] hover:bg-[var(--card-2)]"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </SpecField>
              <SpecField label="Brand guardrail">
                <p className="text-sm text-[#7b8698]">
                  Palet {brand.name} ({brand.primaryColor} + {brand.secondaryColor}) · nada brand — auto, tak boleh diubah
                </p>
              </SpecField>
            </div>

            {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            {/* Actions */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={confirm}
                disabled={busy || confirmed}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  confirmed
                    ? "border border-[var(--ok)] bg-[var(--ok-soft)] text-[var(--ok)]"
                    : "bg-[var(--brand)] text-white hover:bg-[var(--brand-2)] disabled:opacity-40"
                }`}
              >
                {confirmed ? "✓ Idea disahkan" : busy ? "…" : "✓ Sahkan Idea"}
              </button>
              <span className="text-[var(--line-2)]">→</span>
              <button
                onClick={() => setPhase("generate")}
                disabled={!confirmed}
                className="rounded-xl bg-[var(--orange)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--orange-2)] disabled:opacity-40"
              >
                ⚡ Generate Poster
              </button>
              {!confirmed && <span className="text-xs text-[#a6aebb]">(Sahkan Idea dulu)</span>}
              <button
                onClick={() => { setPhase("brief"); setConfirmed(false); }}
                className="ml-auto rounded-xl border border-[var(--line-2)] px-3 py-2 text-sm font-medium text-[#33414f] hover:bg-[var(--card-2)]"
              >
                ↻ Ubah Spec
              </button>
            </div>
            <p className="mt-3 rounded-lg bg-[var(--card-2)] p-3 text-[11px] leading-5 text-[#7b8698]">
              ⓘ Idea ni dah disimpan ke <b>Semakan Lepas</b> sebagai <b>draft</b> — boleh edit / generate kemudian.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// Small presentational helpers ────────────────────────────────────────────────

function BriefRow({ k, v, accent, last }: { k: string; v: string; accent?: boolean; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-1.5 ${last ? "" : "border-b border-[var(--line)]"}`}>
      <span className="text-[11px] text-[#7b8698]">{k}</span>
      <span className={`text-[11px] font-medium ${accent ? "text-[var(--orange)]" : "text-[#00262a]"}`}>{v}</span>
    </div>
  );
}

function SpecField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
      <span className="w-[110px] shrink-0 pt-1.5 text-xs font-semibold uppercase text-[#7b8698]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// "Tulis sendiri" chip → toggles an inline text input that commits on Enter/blur.
function CustomChip({ label, onSet }: { label: string; onSet: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  if (open) {
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { onSet(val.trim()); setOpen(false); setVal(""); } }}
        onBlur={() => { if (val.trim()) onSet(val.trim()); setOpen(false); setVal(""); }}
        placeholder="Taip…"
        className="w-28 rounded-full border border-[var(--brand)] bg-white px-3 py-1.5 text-xs text-[#00262a] outline-none"
      />
    );
  }
  return (
    <button
      onClick={() => setOpen(true)}
      className="rounded-full border border-dashed border-[var(--line-2)] px-3 py-1.5 text-xs font-medium text-[#7b8698] hover:bg-[var(--card-2)]"
    >
      ✎ {label}
    </button>
  );
}
