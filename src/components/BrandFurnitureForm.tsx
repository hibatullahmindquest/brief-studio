"use client";

import { useState, useRef } from "react";

export type BrandFurniture = {
  slug: string;
  name: string;
  logoUrlLight: string | null; // logo for LIGHT backgrounds (dark-ink logo)
  logoUrlDark: string | null;  // logo for DARK backgrounds (light/white logo)
  posterFooterLeft: string;
  posterFooterRight: string;
  primaryColor: string;
};

// Admin control for one brand's poster furniture: two transparent logo PNGs
// (light-bg + dark-bg variants, overlay auto-picks by contrast) + two footer
// text lines (overlay bottom bar). Saved per brand.
export function BrandFurnitureForm({ brand }: { brand: BrandFurniture }) {
  const [left, setLeft] = useState(brand.posterFooterLeft);
  const [right, setRight] = useState(brand.posterFooterRight);
  const [savingFooter, setSavingFooter] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

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

  return (
    <section className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: brand.primaryColor }} />
        <h2 className="text-lg font-semibold text-[#00262a]">{brand.name}</h2>
      </div>

      {/* Logo — two variants; the overlay auto-picks by contrast at gen time */}
      <div className="mt-4">
        <p className="eyebrow">Logo poster</p>
        <p className="mt-1 text-xs text-[#7b8698]">
          PNG transparan, distamp kiri-atas poster. Upload dua versi — sistem pilih yang kontras dengan background poster automatik. Max 2MB.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <LogoSlot
            slug={brand.slug}
            variant="dark"
            label="Untuk background gelap"
            hint="logo cerah / putih"
            previewBg="#0b1c73"
            initialUrl={brand.logoUrlDark}
            onMsg={setMsg}
          />
          <LogoSlot
            slug={brand.slug}
            variant="light"
            label="Untuk background terang"
            hint="logo gelap"
            previewBg="#ffffff"
            initialUrl={brand.logoUrlLight}
            onMsg={setMsg}
          />
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

// One logo variant upload (light- or dark-background version). Previews on a
// representative background so the admin can see contrast; posts with `variant`.
function LogoSlot({
  slug, variant, label, hint, previewBg, initialUrl, onMsg,
}: {
  slug: string;
  variant: "light" | "dark";
  label: string;
  hint: string;
  previewBg: string;
  initialUrl: string | null;
  onMsg: (m: { kind: "ok" | "err"; text: string }) => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [bust, setBust] = useState(0); // cache-bust preview after re-upload (path is stable)
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("slug", slug);
      form.set("variant", variant);
      form.set("file", file);
      const res = await fetch("/api/brand/logo", { method: "POST", body: form });
      const data = (await res.json()) as { logoUrl?: string; error?: string };
      if (res.ok && data.logoUrl) {
        setUrl(data.logoUrl);
        setBust(Date.now());
        onMsg({ kind: "ok", text: `Logo (${label.toLowerCase()}) dikemaskini.` });
      } else {
        onMsg({ kind: "err", text: data.error ?? "Gagal upload logo." });
      }
    } catch {
      onMsg({ kind: "err", text: "Ralat rangkaian semasa upload." });
    } finally {
      setUploading(false);
    }
  }

  const previewSrc = url ? `${url}${bust ? `?v=${bust}` : ""}` : null;

  return (
    <div className="rounded-2xl border border-[var(--line)] p-3">
      <p className="text-xs font-semibold text-[#00262a]">{label}</p>
      <p className="text-[11px] text-[#a6aebb]">{hint}</p>
      <div className="mt-2 flex items-center gap-3">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--line-2)]"
          style={{ background: previewBg }}
        >
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt={`${label} logo`} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-[#a6aebb]" style={{ mixBlendMode: "difference", color: "#888" }}>—</span>
          )}
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-xl border border-[var(--line-2)] px-3 py-1.5 text-sm font-semibold text-[#33414f] transition hover:bg-[var(--card-2)] disabled:opacity-40"
          >
            {uploading ? "Memuat naik…" : previewSrc ? "Tukar" : "Upload PNG"}
          </button>
        </div>
      </div>
    </div>
  );
}
