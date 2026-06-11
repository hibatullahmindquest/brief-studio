"use client";

import type { OutputType } from "@/lib/conversation-engine";
import type { BrandSummary, GeneratedOutput } from "./StudioWizard";

export function GenerationResult({
  result,
  brand,
  outputType,
  onReset,
  onRegenerate,
}: {
  result: GeneratedOutput;
  brand: BrandSummary;
  outputType: OutputType;
  answers: Record<string, string>;
  onReset: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="editorial-panel rounded-4xl p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="editorial-kicker">{brand.name} · {outputType.label}</p>
            <h2 className="editorial-title mt-2 text-3xl sm:text-4xl">Output dijana</h2>
            <p className="mt-1 text-xs editorial-muted">
              {new Date(result.generatedAt).toLocaleString("ms-MY")}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRegenerate}
              className="rounded-full border border-white/10 px-4 py-2 text-sm editorial-muted hover:border-white/20 transition"
            >
              Regenerate
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
            >
              + Baru
            </button>
          </div>
        </div>
      </div>

      <div className="editorial-panel rounded-4xl p-6 sm:p-8 space-y-4">
        <div className="rounded-3xl border border-white/10 p-5">
          <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Primary Post</p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-7">{result.primaryPost}</pre>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/10 p-5">
            <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Caption</p>
            <p className="mt-3 text-sm leading-7 editorial-muted">{result.caption}</p>
          </div>
          <div className="rounded-3xl border border-white/10 p-5">
            <p className="text-xs uppercase tracking-[0.2em] editorial-muted">CTA</p>
            <p className="mt-3 text-sm leading-7 editorial-muted">{result.callToAction}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 p-5">
          <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Hashtags</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.hashtags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs editorial-muted"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 p-5">
          <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Strategy Note</p>
          <p className="mt-3 text-sm leading-7 editorial-muted">{result.strategyNote}</p>
        </div>
      </div>
    </div>
  );
}
