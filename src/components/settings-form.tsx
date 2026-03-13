"use client";

import { useState } from "react";

type Tone = "Bold" | "Luxury" | "Hype";

export function SettingsForm({
  initialBrandName,
  initialTone,
  initialCoreOffer,
}: {
  initialBrandName: string;
  initialTone: Tone;
  initialCoreOffer: string;
}) {
  const [brandName, setBrandName] = useState(initialBrandName);
  const [defaultTone, setDefaultTone] = useState<Tone>(initialTone);
  const [coreOffer, setCoreOffer] = useState(initialCoreOffer);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          defaultTone,
          coreOffer,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setSuccess("Preferences saved.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="editorial-panel rounded-4xl p-6 sm:p-8">
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm">Brand name</span>
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm">Default tone</span>
          <select
            value={defaultTone}
            onChange={(e) => setDefaultTone(e.target.value as Tone)}
            className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm"
          >
            <option>Bold</option>
            <option>Luxury</option>
            <option>Hype</option>
          </select>
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm">Core offer</span>
          <input
            value={coreOffer}
            onChange={(e) => setCoreOffer(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm"
          />
        </label>

        {error && (
          <p className="md:col-span-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {success && !error && (
          <p className="md:col-span-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="editorial-button editorial-button-primary md:col-span-2 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save preferences"}
        </button>
      </form>
    </section>
  );
}
