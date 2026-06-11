"use client";

import { useState } from "react";
import { BrandPicker } from "./BrandPicker";
import { OutputTypePicker } from "./OutputTypePicker";
import { ConversationStep } from "./ConversationStep";
import { BriefReview } from "./BriefReview";
import { GenerationResult } from "./GenerationResult";
import { getOutputType } from "@/lib/conversation-engine";

export type Stage =
  | "SELECT_BRAND"
  | "SELECT_OUTPUT"
  | "CONVERSATION"
  | "REVIEW"
  | "GENERATING"
  | "RESULT";

export type BrandSummary = {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  secondaryColor: string;
  tagline: string;
};

export type GeneratedOutput = {
  primaryPost: string;
  caption: string;
  callToAction: string;
  hashtags: string[];
  strategyNote: string;
  generatedAt: string;
};

const PROGRESS_STEPS = ["Brand", "Output", "Brief", "Review"];

export function StudioWizard({ userId: _userId }: { userId: string }) {
  const [stage, setStage] = useState<Stage>("SELECT_BRAND");
  const [brand, setBrand] = useState<BrandSummary | null>(null);
  const [outputTypeId, setOutputTypeId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [result, setResult] = useState<GeneratedOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const outputType = outputTypeId ? getOutputType(outputTypeId) : null;

  function reset() {
    setBrand(null);
    setOutputTypeId(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setResult(null);
    setError(null);
    setStage("SELECT_BRAND");
  }

  function handleBrandSelect(b: BrandSummary) {
    setBrand(b);
    setStage("SELECT_OUTPUT");
  }

  function handleOutputSelect(id: string) {
    setOutputTypeId(id);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setStage("CONVERSATION");
  }

  function handleAnswer(questionId: string, answer: string) {
    const updated = { ...answers, [questionId]: answer };
    setAnswers(updated);
    if (!outputType) return;
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= outputType.questions.length) {
      setStage("REVIEW");
    } else {
      setCurrentQuestionIndex(nextIndex);
    }
  }

  function handleBack() {
    if (stage === "SELECT_OUTPUT") { setStage("SELECT_BRAND"); return; }
    if (stage === "CONVERSATION") {
      if (currentQuestionIndex === 0) { setStage("SELECT_OUTPUT"); return; }
      setCurrentQuestionIndex((i) => i - 1);
      return;
    }
    if (stage === "REVIEW") {
      setStage("CONVERSATION");
      setCurrentQuestionIndex((outputType?.questions.length ?? 1) - 1);
      return;
    }
  }

  async function handleGenerate() {
    if (!brand || !outputType) return;
    setStage("GENERATING");
    setError(null);

    const product =
      answers["promo"] || answers["story"] || answers["objective"] || outputType.label;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandSlug: brand.slug,
          product,
          contentType: outputType.label,
          briefAnswers: answers,
          variant: 1,
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) ?? "Generation gagal. Cuba semula.");
        setStage("REVIEW");
        return;
      }
      setResult(data as GeneratedOutput);
      setStage("RESULT");
    } catch {
      setError("Network error. Semak sambungan internet.");
      setStage("REVIEW");
    }
  }

  const progressIndex =
    stage === "SELECT_BRAND" ? 0 :
    stage === "SELECT_OUTPUT" ? 1 :
    stage === "CONVERSATION" ? 2 : 3;

  const showProgress = stage !== "RESULT" && stage !== "GENERATING";

  return (
    <div className="space-y-4">
      {showProgress && (
        <div className="editorial-panel rounded-4xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-2">
              {PROGRESS_STEPS.map((label, i) => (
                <span
                  key={label}
                  className={`text-xs font-medium px-3 py-1 rounded-full border transition ${
                    i === progressIndex
                      ? "border-(--accent) bg-[rgba(212,183,143,0.12)] text-foreground"
                      : i < progressIndex
                      ? "border-white/20 text-white/50"
                      : "border-white/10 text-white/20"
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
            {stage === "CONVERSATION" && outputType && (
              <span className="text-xs editorial-muted">
                {currentQuestionIndex + 1} / {outputType.questions.length}
              </span>
            )}
          </div>
          <div className="h-1 w-full rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[rgba(212,183,143,0.9)] transition-all duration-500"
              style={{ width: `${(progressIndex / (PROGRESS_STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {stage === "SELECT_BRAND" && (
        <BrandPicker onSelect={handleBrandSelect} />
      )}

      {stage === "SELECT_OUTPUT" && brand && (
        <OutputTypePicker
          brand={brand}
          onSelect={handleOutputSelect}
          onBack={() => setStage("SELECT_BRAND")}
        />
      )}

      {stage === "CONVERSATION" && outputType && brand && (
        <ConversationStep
          question={outputType.questions[currentQuestionIndex]}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={outputType.questions.length}
          existingAnswer={answers[outputType.questions[currentQuestionIndex].id]}
          brand={brand}
          outputTypeLabel={outputType.label}
          onAnswer={handleAnswer}
          onBack={handleBack}
          canSkip={!outputType.questions[currentQuestionIndex].required}
        />
      )}

      {stage === "REVIEW" && outputType && brand && (
        <BriefReview
          brand={brand}
          outputType={outputType}
          answers={answers}
          error={error}
          onConfirm={handleGenerate}
          onBack={handleBack}
          onEditAnswer={(qId) => {
            const idx = outputType.questions.findIndex((q) => q.id === qId);
            if (idx >= 0) { setCurrentQuestionIndex(idx); setStage("CONVERSATION"); }
          }}
        />
      )}

      {stage === "GENERATING" && (
        <div className="editorial-panel rounded-4xl p-10 text-center space-y-4">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          <p className="editorial-title text-3xl">AI sedang menjana output...</p>
          <p className="text-sm editorial-muted">Mengambil masa 10–30 saat</p>
        </div>
      )}

      {stage === "RESULT" && result && brand && outputType && (
        <GenerationResult
          result={result}
          brand={brand}
          outputType={outputType}
          answers={answers}
          onReset={reset}
          onRegenerate={handleGenerate}
        />
      )}
    </div>
  );
}
