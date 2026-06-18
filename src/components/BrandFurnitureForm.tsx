"use client";

import { useState, useRef } from "react";

export type BrandFurniture = {
  slug: string;
  name: string;
  logoUrl: string | null;
  posterFooterLeft: string;
  posterFooterRight: string;
  primaryColor: string;
};

// Admin control for one brand's poster furniture: transparent logo PNG (overlay
// top-left) + two footer text lines (overlay bottom bar). Saved per brand.
export function BrandFurnitureForm({ brand }: { brand: BrandFurniture }) {
  const [logoUrl, setLogoUrl] = useState(brand.logoUrl);
  const [logoBust, setLogoBust] = useState(0); // cache-bust the preview after re-upload
  const [left, setLeft] = useState(brand.posterFooterLeft);
  const [right, setRight] = useState(brand.posterFooterRight);
  const [uploading, setUploading] = useState(false);
  const [savingFooter, setSavingFooter] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function uploadLogo(file: File) {
    setUploading(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.set("slug", brand.slug);
      form.set("file", file);
      const res = await fetch("/api/brand/logo", { method: "POST", body: form });
      const data = (await res.json()) as { logoUrl?: string; error?: string };
      if (res.ok && data.logoUrl) {
        setLogoUrl(data.logoUrl);
        setLogoBust(Date.now());
        setMsg({ kind: "ok", text: "Logo dikemaskini." });
      } else {
        setMsg({ kind: "err", text: data.error ?? "Gagal upload logo." });
      }
    } catch {
      setMsg({ kind: "err", text: "Ralat rangkaian semasa upload." });
    } finally {
      setUploading(false);
    }
  }

  async function saveFooter() {
    setSavingFooter(true);
    setMsg(null);
    try {
      const res = await fetch("/api/brand", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: brand.slug, posterFooterLeft: left, posterFooterRight: right }),
      });
      const data = (await res.json()) as { error?: string };
      setMsg(res.ok ? { kind: "ok", text: "Footer disimpan." } : { kind: "err", text: data.error ?? "Gagal simpan footer." });
    } catch {
      setMsg({ kind: "err", text: "Ralat rangkaian." });
    } finally {
      setSavingFooter(false);
    }
  }

  const previewSrc = logoUrl ? `${logoUrl}${logoBust ? `?v=${logoBust}` : ""}` : null;

  return (
    <section className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: brand.primaryColor }} />
        <h2 className="text-lg font-semibold text-[#00262a]">{brand.name}</h2>
      </div>

      {/* Logo */}
      <div className="mt-4">
        <p className="eyebrow">Logo poster</p>
        <p className="mt-1 text-xs text-[#7b8698]">PNG transparan. Distamp di kiri-atas setiap poster yang dijana. Max 2MB.</p>
        <div className="mt-3 flex items-center gap-4">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--line-2)]"
            style={{ background: "repeating-conic-gradient(#eef0f4 0% 25%, #fff 0% 50%) 50% / 16px 16px" }}
          >
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSrc} alt={`${brand.name} logo`} className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-[10px] text-[#a6aebb]">Tiada logo</span>
            )}
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); e.target.value = ""; }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-xl border border-[var(--line-2)] px-4 py-2 text-sm font-semibold text-[#33414f] transition hover:bg-[var(--card-2)] disabled:opacity-40"
            >
              {uploading ? "Memuat naik…" : previewSrc ? "Tukar logo" : "Upload logo PNG"}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-5">
        <p className="eyebrow">Footer poster</p>
        <p className="mt-1 text-xs text-[#7b8698]">Jalur bawah poster — teks kiri &amp; kanan.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-[#7b8698]">Kiri</span>
            <input
              value={left}
              onChange={(e) => setLeft(e.target.value)}
              maxLength={120}
              placeholder="© 2026 SifuTutor"
              className="mt-1 w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[#00262a] outline-none focus:border-[var(--brand)]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#7b8698]">Kanan</span>
            <input
              value={right}
              onChange={(e) => setRight(e.target.value)}
              maxLength={120}
              placeholder="www.sifututor.com"
              className="mt-1 w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[#00262a] outline-none focus:border-[var(--brand)]"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={saveFooter}
          disabled={savingFooter}
          className="mt-3 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-2)] disabled:opacity-40"
        >
          {savingFooter ? "Menyimpan…" : "Simpan footer"}
        </button>
      </div>

      {msg && (
        <p className={`mt-4 rounded-xl border p-3 text-sm ${msg.kind === "ok" ? "border-[var(--ok)] bg-[var(--ok-soft)] text-[var(--ok)]" : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
