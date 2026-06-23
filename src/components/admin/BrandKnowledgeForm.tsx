"use client";

import { useState } from "react";
import { ChipListInput } from "./ChipListInput";

export type BrandKnowledge = {
  slug: string;
  name: string;
  primaryColor: string;
  contentPillars: string[];
  audienceSegments: string[];
  doNot: string[];
  signaturePhrases: string[];
  colors: string[];
  fonts: string[];
  religiousGuidelines: string;
  footer: string;
  logoPath: string;
};

type Msg = { kind: "ok" | "err"; text: string } | null;

// Per-brand editor for the M1 grounding knowledge (the structured context injected
// into every expert call). Sits below the Logo & Overlay section. One Save → one
// PATCH /api/brand. Colours are picked via a native swatch so only valid hex enters.
export function BrandKnowledgeForm({ brand }: { brand: BrandKnowledge }) {
  const [contentPillars, setContentPillars] = useState(brand.contentPillars);
  const [audienceSegments, setAudienceSegments] = useState(brand.audienceSegments);
  const [doNot, setDoNot] = useState(brand.doNot);
  const [signaturePhrases, setSignaturePhrases] = useState(brand.signaturePhrases);
  const [colors, setColors] = useState(brand.colors);
  const [fonts, setFonts] = useState(brand.fonts);
  const [religiousGuidelines, setReligiousGuidelines] = useState(brand.religiousGuidelines);
  const [footer, setFooter] = useState(brand.footer);
  const [logoPath, setLogoPath] = useState(brand.logoPath);
  const [picker, setPicker] = useState("#3b4ee2");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  function addColor() {
    const hex = picker.toLowerCase();
    if (!colors.includes(hex)) setColors([...colors, hex]);
  }
  function removeColor(c: string) {
    setColors(colors.filter((x) => x !== c));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/brand", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: brand.slug,
          contentPillars, audienceSegments, doNot, signaturePhrases, colors, fonts,
          religiousGuidelines, footer, logoPath,
        }),
      });
      const data = (await res.json()) as { error?: string };
      setMsg(res.ok ? { kind: "ok", text: "Brand knowledge disimpan." } : { kind: "err", text: data.error ?? "Gagal simpan." });
    } catch {
      setMsg({ kind: "err", text: "Ralat rangkaian." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: brand.primaryColor }} />
        <h2 className="text-lg font-semibold text-[#00262a]">{brand.name} — Brand Knowledge</h2>
      </div>
      <p className="mt-1 text-xs text-[#7b8698]">
        Konteks berstruktur yang disuntik ke setiap generation. Diasingkan dari overlay poster di atas.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <ChipListInput label="Content pillars" values={contentPillars} onChange={setContentPillars} placeholder="+ tambah pillar" />
        <ChipListInput label="Audience segments" values={audienceSegments} onChange={setAudienceSegments} placeholder="+ tambah segmen" />
        <ChipListInput label="Do-not" values={doNot} onChange={setDoNot} placeholder="+ perkara yang elak" tone="danger" helper="Menggantikan legacy 'dontSay'." />
        <ChipListInput label="Signature phrases" values={signaturePhrases} onChange={setSignaturePhrases} placeholder="+ frasa jenama" />
        <ChipListInput label="Fonts" values={fonts} onChange={setFonts} placeholder="+ nama font" />

        {/* Colours — swatch picker so only valid #rrggbb is added */}
        <div className="block">
          <span className="text-xs font-medium text-[#7b8698]">Palette (hex)</span>
          <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line-2)] bg-white p-2">
            {colors.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-2)] bg-[var(--card-2)] px-2 py-1 text-xs font-medium text-[#33414f]">
                <span className="inline-block h-3.5 w-3.5 rounded-full border border-[var(--line-2)]" style={{ backgroundColor: c }} />
                <span className="font-mono">{c}</span>
                <button type="button" onClick={() => removeColor(c)} className="text-[#a6aebb] transition hover:text-red-600" aria-label={`Remove ${c}`}>✕</button>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <input type="color" value={picker} onChange={(e) => setPicker(e.target.value)} className="h-7 w-7 cursor-pointer rounded border border-[var(--line-2)] bg-white p-0.5" aria-label="Pick colour" />
              <button type="button" onClick={addColor} className="rounded-full border border-dashed border-[var(--line-2)] px-2 py-0.5 text-[11px] text-[#7b8698] transition hover:border-[var(--brand)] hover:text-[var(--brand)]">+ add</button>
            </span>
          </div>
          <span className="mt-1 block text-[11px] text-[#a6aebb]">Legacy primary/secondary dipakai overlay poster; palette ini untuk AI grounding.</span>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-[#7b8698]">Religious guidelines</span>
        <textarea
          value={religiousGuidelines}
          onChange={(e) => setReligiousGuidelines(e.target.value)}
          rows={4}
          placeholder="cth. patuh syariah, elak gambar bernyawa penuh, guna istilah Islamik yang betul…"
          className="mt-1 w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm leading-6 text-[#00262a] outline-none focus:border-[var(--brand)]"
        />
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-[#7b8698]">Footer (canonical)</span>
          <input
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            placeholder="www.sifututor.com"
            className="mt-1 w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[#00262a] outline-none focus:border-[var(--brand)]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[#7b8698]">Logo path (canonical)</span>
          <input
            value={logoPath}
            onChange={(e) => setLogoPath(e.target.value)}
            placeholder="/uploads/brand/sifututor-logo.png"
            className="mt-1 w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 font-mono text-[13px] text-[#00262a] outline-none focus:border-[var(--brand)]"
          />
          <span className="mt-1 block text-[11px] text-[#a6aebb]">Upload logo variant di atas ialah flow utama.</span>
        </label>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-4 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-2)] disabled:opacity-40"
      >
        {saving ? "Menyimpan…" : "Simpan brand knowledge"}
      </button>

      {msg && (
        <p className={`mt-4 rounded-xl border p-3 text-sm ${msg.kind === "ok" ? "border-[var(--ok)] bg-[var(--ok-soft)] text-[var(--ok)]" : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
