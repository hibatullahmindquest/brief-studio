"use client";

import type { OutputType } from "@/lib/conversation-engine";
import type { BrandSummary } from "./StudioWizard";

export function BriefReview({
  brand,
  outputType,
  answers,
  error,
  onConfirm,
  onBack,
  onEditAnswer,
}: {
  brand: BrandSummary;
  outputType: OutputType;
  answers: Record<string, string>;
  error: string | null;
  onConfirm: () => void;
  onBack: () => void;
  onEditAnswer: (questionId: string) => void;
}) {
  return (
    <div className="editorial-panel rounded-4xl p-6 sm:p-8 space-y-6">
      <div>
        <p className="editorial-kicker">Review Brief</p>
        <h2 className="editorial-title mt-2 text-3xl sm:text-4xl">Ini yang AI faham</h2>
        <p className="mt-2 text-sm editorial-muted">
          Semak dan betulkan jika perlu sebelum generate.
        </p>
      </div>

      <div className="rounded-3xl border border-[var(--line)] divide-y divide-white/10">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs editorial-muted uppercase tracking-[0.15em]">Brand</p>
            <p className="mt-1 text-sm font-medium">{brand.name}</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs editorial-muted uppercase tracking-[0.15em]">Output</p>
            <p className="mt-1 text-sm font-medium">{outputType.label}</p>
          </div>
        </div>
        {outputType.questions.map((q) => {
          const answer = answers[q.id];
          if (!answer || answer === "—") return null;
          return (
            <div key={q.id} className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="flex-1">
                <p className="text-xs editorial-muted uppercase tracking-[0.15em]">{q.text}</p>
                <p className="mt-1 text-sm">{answer}</p>
              </div>
              <button
                type="button"
                onClick={() => onEditAnswer(q.id)}
                className="shrink-0 text-xs editorial-muted hover:text-foreground transition underline"
              >
                Edit
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          ⚠️ {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-[var(--line)] px-5 py-3 text-sm editorial-muted hover:border-[var(--line-2)] transition"
        >
          ← Balik
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
        >
          Confirm & Generate →
        </button>
      </div>
    </div>
  );
}
