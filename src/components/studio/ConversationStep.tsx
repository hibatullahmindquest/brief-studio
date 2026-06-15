"use client";

import { useState } from "react";
import type { Question } from "@/lib/conversation-engine";
import type { BrandSummary } from "./StudioWizard";

export function ConversationStep({
  question,
  questionNumber,
  totalQuestions,
  existingAnswer,
  brand,
  outputTypeLabel,
  onAnswer,
  onBack,
  canSkip,
}: {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  existingAnswer?: string;
  brand: BrandSummary;
  outputTypeLabel: string;
  onAnswer: (questionId: string, answer: string) => void;
  onBack: () => void;
  canSkip: boolean;
}) {
  const [selected, setSelected] = useState<string>(() => {
    if (existingAnswer && question.options?.includes(existingAnswer)) return existingAnswer;
    return "";
  });
  const [textValue, setTextValue] = useState<string>(() => {
    if (existingAnswer && question.options && !question.options.includes(existingAnswer)) {
      return existingAnswer;
    }
    return "";
  });

  const effectiveAnswer = textValue.trim() || selected;

  function handleChipClick(option: string) {
    setSelected((prev) => (prev === option ? "" : option));
    if (question.answerType === "chips") setTextValue("");
  }

  function handleSubmit() {
    const answer = textValue.trim() || selected;
    if (!answer && question.required) return;
    onAnswer(question.id, answer || "—");
  }

  return (
    <div className="editorial-panel rounded-4xl p-6 sm:p-8 space-y-6">
      <div className="flex items-center gap-2 text-xs editorial-muted">
        <span
          className="inline-block h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: brand.primaryColor }}
        />
        <span>{brand.name}</span>
        <span>·</span>
        <span>{outputTypeLabel}</span>
        <span>·</span>
        <span>Soalan {questionNumber} dari {totalQuestions}</span>
      </div>

      <div>
        <h2 className="editorial-title text-3xl sm:text-4xl">{question.text}</h2>
        {question.subtext && (
          <p className="mt-2 text-sm editorial-muted">{question.subtext}</p>
        )}
      </div>

      {question.options && question.options.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {question.options.map((option) => {
            const active = selected === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleChipClick(option)}
                className={`rounded-full border px-5 py-2.5 text-sm font-medium transition ${
                  active
                    ? "border-(--accent) bg-[rgba(212,183,143,0.15)] text-foreground"
                    : "border-[var(--line)] bg-white editorial-muted hover:border-[var(--line-2)]"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}

      {(question.answerType === "text" || question.answerType === "chips+text") && (
        <div>
          {question.answerType === "chips+text" && (
            <p className="mb-2 text-xs editorial-muted">Atau terangkan dengan lebih spesifik:</p>
          )}
          <textarea
            value={textValue}
            onChange={(e) => {
              setTextValue(e.target.value);
              if (e.target.value) setSelected("");
            }}
            placeholder={question.placeholder}
            rows={3}
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-muted focus:border-(--accent) resize-none"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-[var(--line)] px-5 py-3 text-sm editorial-muted hover:border-[var(--line-2)] transition"
        >
          ← Balik
        </button>

        {canSkip && !effectiveAnswer && (
          <button
            type="button"
            onClick={() => onAnswer(question.id, "—")}
            className="rounded-full border border-[var(--line)] px-5 py-3 text-sm editorial-muted hover:border-[var(--line-2)] transition"
          >
            Skip
          </button>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={question.required && !effectiveAnswer}
          className="flex-1 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Seterusnya →
        </button>
      </div>
    </div>
  );
}
