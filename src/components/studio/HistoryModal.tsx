"use client";

import { useEffect } from "react";
import type { HistoryRun } from "@/lib/feature-store";
import { VisualPanel } from "./VisualPanel";

const VISUAL_TYPES = new Set(["poster", "storyboard", "video_script"]);

const BRAND_NAMES: Record<string, string> = {
  sifututor: "SifuTutor",
  nakngaji: "NakNgaji",
};

const BRAND_COLORS: Record<string, string> = {
  sifututor: "#0b1c73",
  nakngaji: "#1a7a4a",
};

export function HistoryModal({
  run,
  onClose,
}: {
  run: HistoryRun;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const brandName = run.brandSlug ? (BRAND_NAMES[run.brandSlug] ?? run.brandSlug) : "—";
  const brandColor = run.brandSlug ? (BRAND_COLORS[run.brandSlug] ?? "#888") : "#888";
  const { fullOutput, image } = run;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto editorial-panel rounded-3xl p-5 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs editorial-muted">
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: brandColor }}
              />
              <span>{brandName}</span>
              <span>·</span>
              <span>{run.subtype ?? "Generation"}</span>
            </div>
            <p className="mt-1 text-xs editorial-muted">
              {new Date(run.createdAt).toLocaleString("ms-MY")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs editorial-muted hover:border-[var(--line-2)] transition"
          >
            Tutup ✕
          </button>
        </div>

        {image && (
          <div className="rounded-3xl border border-[var(--line)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.2em] editorial-muted">
                Visual · {image.kind === "poster" ? "Poster" : "Storyboard"}
              </p>
              {typeof image.generatedMs === "number" && image.generatedMs > 0 && (
                <span className="rounded-md bg-[var(--card-2)] px-2 py-1 mono text-[11px] text-[#7b8698]">
                  ⏱ {Math.round(image.generatedMs / 1000)}s
                </span>
              )}
            </div>
            <div className="mt-3 flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.urlPath}
                alt="Generated visual"
                className="rounded-xl border border-[var(--line-2)]"
                style={{
                  display: "block",
                  height: "auto",
                  width: image.kind === "poster" ? "auto" : "100%",
                  maxWidth: image.kind === "poster" ? "180px" : "100%",
                }}
              />
            </div>
            {image.scenes?.length > 0 && (
              <div className="mt-3">
                {image.scenes.map((s) => (
                  <div key={s.no} className="flex gap-3 border-b border-[var(--line)] py-1.5 text-xs last:border-0">
                    <b className="shrink-0 text-[var(--brand)]" style={{ width: 52 }}>Scene {s.no}</b>
                    <span className="editorial-muted">{s.caption}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* No image yet + a visual output type → let the user generate it now. */}
        {!image && VISUAL_TYPES.has(run.outputTypeId) && (
          <VisualPanel featureRunId={run.id} outputTypeId={run.outputTypeId} />
        )}

        <div className="rounded-3xl border border-[var(--line)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Primary Post</p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-7">
            {fullOutput.primaryPost}
          </pre>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-[var(--line)] p-5">
            <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Caption</p>
            <p className="mt-3 text-sm leading-7 editorial-muted">{fullOutput.caption}</p>
          </div>
          <div className="rounded-3xl border border-[var(--line)] p-5">
            <p className="text-xs uppercase tracking-[0.2em] editorial-muted">CTA</p>
            <p className="mt-3 text-sm leading-7 editorial-muted">{fullOutput.callToAction}</p>
          </div>
        </div>

        {fullOutput.hashtags?.length > 0 && (
          <div className="rounded-3xl border border-[var(--line)] p-5">
            <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Hashtags</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {fullOutput.hashtags.map((tag, i) => (
                <span
                  key={`${tag}-${i}`}
                  className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs editorial-muted"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-[var(--line)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Strategy Note</p>
          <p className="mt-3 text-sm leading-7 editorial-muted">{fullOutput.strategyNote}</p>
        </div>
      </div>
    </div>
  );
}
