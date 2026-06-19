"use client";

import { useState } from "react";
import type { OutputType } from "@/lib/conversation-engine";
import type { BrandSummary, GeneratedOutput } from "./StudioWizard";
import { GenerationResult } from "./GenerationResult";
import { ChatBubble, TypingDots, Chip } from "./chat-ui";

type Stage = "asking" | "generating" | "result";

// Generic per-output Q&A rendered as a chat (non-poster output types). Each
// question is an AI bubble; the answer becomes a user bubble. On the last
// answer it generates via /api/generate and shows the existing result panel.
export function ChatConversation({
  brand,
  outputType,
  onReset,
}: {
  brand: BrandSummary;
  outputType: OutputType;
  onReset: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const [stage, setStage] = useState<Stage>("asking");
  const [result, setResult] = useState<GeneratedOutput | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const questions = outputType.questions;
  const current = stage === "asking" && idx < questions.length ? questions[idx] : null;

  async function generate(finalAnswers: Record<string, string>) {
    setStage("generating");
    setError(null);
    const product = finalAnswers["promo"] || finalAnswers["story"] || finalAnswers["objective"] || outputType.label;
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandSlug: brand.slug, product, contentType: outputType.label, briefAnswers: finalAnswers, variant: 1 }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) ?? "Generation gagal. Cuba semula.");
        setStage("asking");
        return;
      }
      setResult(data as unknown as GeneratedOutput);
      setRunId(typeof data.id === "string" ? data.id : null);
      setStage("result");
      window.dispatchEvent(new CustomEvent("generation:complete"));
    } catch {
      setError("Network error. Semak sambungan internet.");
      setStage("asking");
    }
  }

  function answer(value: string) {
    if (!current) return;
    const v = value.trim();
    if (current.required && !v) return;
    const stored = v || "—";
    const next = { ...answers, [current.id]: stored };
    setAnswers(next);
    setDraft("");
    const ni = idx + 1;
    if (ni >= questions.length) void generate(next);
    else setIdx(ni);
  }

  if (stage === "result" && result) {
    return (
      <GenerationResult
        result={result}
        brand={brand}
        outputType={outputType}
        featureRunId={runId}
        onReset={onReset}
        onRegenerate={() => void generate(answers)}
      />
    );
  }

  return (
    <div className="editorial-panel space-y-3 rounded-3xl p-5 sm:p-6">
      {/* Answered questions */}
      {questions.slice(0, idx).map((q) => (
        <div key={q.id} className="space-y-3">
          <ChatBubble role="ai">{q.text}</ChatBubble>
          <ChatBubble role="user">{answers[q.id] === "—" ? "(skip)" : answers[q.id]}</ChatBubble>
        </div>
      ))}

      {/* Current question + composer */}
      {current && (
        <>
          <ChatBubble role="ai">
            {current.text}
            {current.subtext && <span className="mt-1 block text-[11px] text-[#7b8698]">{current.subtext}</span>}
          </ChatBubble>
          <ChatBubble role="ai" bare>
            {(current.answerType === "chips" || current.answerType === "chips+text") && current.options && (
              <div className="flex flex-wrap gap-2">
                {current.options.map((opt) =>
                  current.answerType === "chips"
                    ? <Chip key={opt} onClick={() => answer(opt)}>{opt}</Chip>
                    : <Chip key={opt} active={draft === opt} onClick={() => setDraft(opt)}>{opt}</Chip>
                )}
              </div>
            )}
            {(current.answerType === "text" || current.answerType === "chips+text") && (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) answer(draft); }}
                rows={2}
                placeholder={current.placeholder ?? "Taip jawapan…"}
                className={`w-full resize-none rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[#00262a] placeholder-[#a6aebb] outline-none focus:border-[var(--brand)] ${current.answerType === "chips+text" ? "mt-2" : ""}`}
              />
            )}
            {current.answerType !== "chips" && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => answer(draft)}
                  disabled={current.required && !draft.trim()}
                  className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-2)] disabled:opacity-40"
                >
                  Hantar →
                </button>
                {!current.required && (
                  <button onClick={() => answer("—")} className="text-xs font-medium text-[#7b8698] hover:text-[#33414f]">Skip</button>
                )}
              </div>
            )}
          </ChatBubble>
        </>
      )}

      {stage === "generating" && <TypingDots label="AI sedang menjana output… 10–30 saat" />}
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
