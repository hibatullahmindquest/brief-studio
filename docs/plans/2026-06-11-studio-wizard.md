# Studio Wizard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a conversation-driven creative brief wizard in the Studio page — AI asks structured questions one at a time, gathers requirements, presents a brief summary for confirmation, then generates output.

**Architecture:** State machine with 5 stages: SELECT_BRAND → SELECT_OUTPUT → CONVERSATION → REVIEW → RESULT. Scripted question trees per output type (Option 1 MVP). Questions answered via chips (click) or free text. Brief accumulates per answer and is shown as a summary before generation.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind v4, Prisma, existing `/api/generate` endpoint, existing brand-context system.

---

## Stage Flow

```
SELECT_BRAND → SELECT_OUTPUT → CONVERSATION (Q1→Q2→...→Qn) → REVIEW → GENERATING → RESULT
     ↑                                                             ↓
     └─────────────────── Start Over ────────────────────────────┘
```

---

## Task 1: Brand API Endpoint

**Files:**
- Create: `src/app/api/brand/route.ts`

**Step 1: Create GET handler**

```ts
// src/app/api/brand/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function GET() {
  await requireUser();
  const brands = await prisma.brand.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, primaryColor: true, secondaryColor: true, tagline: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(brands);
}
```

**Step 2: Test manually**

```bash
# Dev server kena running
curl http://localhost:3000/api/brand
# Expected: [{ id, name, slug, primaryColor, secondaryColor, tagline }, ...]
```

**Step 3: Commit**

```bash
git add src/app/api/brand/route.ts
git commit -m "feat(api): add GET /api/brand to list active brands"
```

---

## Task 2: Conversation Engine — Question Trees

**Files:**
- Create: `src/lib/conversation-engine.ts`

**Step 1: Define types and question tree**

```ts
// src/lib/conversation-engine.ts

export type AnswerType = "chips" | "text" | "chips+text";

export type Question = {
  id: string;
  text: string;
  subtext?: string;
  answerType: AnswerType;
  options?: string[];
  placeholder?: string;
  required: boolean;
  // if set, only show this question when a previous answer matches
  showWhen?: { questionId: string; includes: string };
};

export type OutputType = {
  id: string;
  label: string;
  description: string;
  team: "marketing" | "creative" | "video";
  questions: Question[];
};

export const OUTPUT_TYPES: OutputType[] = [
  {
    id: "hook_copy",
    label: "Hook & Copy",
    description: "Hooks, captions, CTA, hashtags",
    team: "marketing",
    questions: [
      {
        id: "promo",
        text: "Apa yang nak dipromosikan?",
        subtext: "Ceritakan secara ringkas",
        answerType: "chips+text",
        options: ["Program baru", "Promo / Offer", "Event", "Pendaftaran dibuka"],
        placeholder: "Contoh: Diskaun 20% untuk pendaftaran tutor Raya",
        required: true,
      },
      {
        id: "platform",
        text: "Platform mana untuk content ni?",
        answerType: "chips",
        options: ["Instagram", "Facebook", "TikTok", "Semua platform"],
        required: true,
      },
      {
        id: "format",
        text: "Format content?",
        answerType: "chips",
        options: ["Feed Post", "Reel", "Story", "Carousel"],
        required: true,
      },
      {
        id: "objective",
        text: "Objective utama content ni?",
        answerType: "chips",
        options: ["Drive pendaftaran", "Awareness", "Tingkat engagement", "Clicks ke website"],
        required: true,
      },
      {
        id: "urgency",
        text: "Ada urgency atau tarikh tamat?",
        answerType: "chips+text",
        options: ["Ya, ada tarikh", "Tidak, open-ended"],
        placeholder: "Contoh: Tamat 31 Mei 2026",
        required: false,
      },
      {
        id: "extra",
        text: "Ada info tambahan untuk AI tahu?",
        subtext: "Optional — boleh skip",
        answerType: "text",
        placeholder: "Contoh: Fokus pada ibu bapa, jangan sebut harga dalam copy",
        required: false,
      },
    ],
  },
  {
    id: "poster",
    label: "Poster",
    description: "Visual poster prompt untuk designer atau AI image",
    team: "creative",
    questions: [
      {
        id: "promo",
        text: "Apa yang nak dipamerkan dalam poster?",
        answerType: "chips+text",
        options: ["Promo Raya", "Program baru", "Event", "Motivational / Brand"],
        placeholder: "Contoh: Pendaftaran tutor diskaun 20%, tamat 31 Mei",
        required: true,
      },
      {
        id: "size",
        text: "Saiz poster?",
        answerType: "chips",
        options: ["1:1 (Feed)", "9:16 (Story/Reel)", "16:9 (YouTube/Banner)", "A4 (Print)"],
        required: true,
      },
      {
        id: "style",
        text: "Style visual poster?",
        answerType: "chips",
        options: ["Clean & minimal", "Bold & energetic", "Warm & family", "Professional & formal"],
        required: true,
      },
      {
        id: "elements",
        text: "Elemen wajib ada dalam poster?",
        answerType: "chips",
        options: ["Tarikh / Deadline", "Harga / Diskaun", "CTA Button", "Logo sahaja"],
        required: false,
      },
      {
        id: "extra",
        text: "Info tambahan untuk designer?",
        answerType: "text",
        placeholder: "Contoh: Gunakan warna biru gelap, ada bulan sabit untuk Raya feel",
        required: false,
      },
    ],
  },
  {
    id: "storyboard",
    label: "Storyboard",
    description: "Scene-by-scene visual breakdown untuk video",
    team: "creative",
    questions: [
      {
        id: "story",
        text: "Cerita apa yang nak disampaikan?",
        answerType: "chips+text",
        options: ["Testimoni student", "Problem & solution", "Before & after", "Brand story"],
        placeholder: "Contoh: Student SPM yang struggle math, lepas guna SifuTutor dapat A",
        required: true,
      },
      {
        id: "scenes",
        text: "Berapa scene?",
        answerType: "chips",
        options: ["3 scenes (pendek)", "5 scenes (standard)", "7 scenes (detail)"],
        required: true,
      },
      {
        id: "platform",
        text: "Platform target?",
        answerType: "chips",
        options: ["Instagram Reel", "TikTok", "YouTube Shorts", "Facebook Video"],
        required: true,
      },
      {
        id: "tone_visual",
        text: "Tone visual?",
        answerType: "chips",
        options: ["Energetic & fast-paced", "Warm & emotional", "Professional & clean", "Fun & youthful"],
        required: true,
      },
    ],
  },
  {
    id: "video_script",
    label: "Video Script",
    description: "Script + shooting plan untuk video production",
    team: "video",
    questions: [
      {
        id: "objective",
        text: "Objective video?",
        answerType: "chips",
        options: ["Drive pendaftaran", "Brand awareness", "Testimoni / Social proof", "Explainer / Tutorial"],
        required: true,
      },
      {
        id: "duration",
        text: "Berapa lama video?",
        answerType: "chips",
        options: ["15 saat", "30 saat", "60 saat", "90 saat"],
        required: true,
      },
      {
        id: "presenter",
        text: "Siapa yang berucap?",
        answerType: "chips",
        options: ["Presenter on-camera", "Voiceover sahaja", "Text on screen", "Kombinasi"],
        required: true,
      },
      {
        id: "cta",
        text: "CTA akhir video?",
        answerType: "chips+text",
        options: ["Daftar sekarang", "Hubungi kami", "Link in bio", "Subscribe"],
        placeholder: "Atau taip CTA spesifik",
        required: true,
      },
      {
        id: "extra",
        text: "Ada arahan khas untuk scriptwriter?",
        answerType: "text",
        placeholder: "Contoh: Guna Bahasa Melayu formal, ada humor ringan",
        required: false,
      },
    ],
  },
];

export function getOutputType(id: string): OutputType | undefined {
  return OUTPUT_TYPES.find((o) => o.id === id);
}

// Build the prompt string from collected answers + brand context
export function buildBriefPrompt(
  outputType: OutputType,
  answers: Record<string, string>
): string {
  const lines = [`Output type: ${outputType.label}`];
  for (const q of outputType.questions) {
    const answer = answers[q.id];
    if (answer) lines.push(`${q.text}: ${answer}`);
  }
  return lines.join("\n");
}
```

**Step 2: Commit**

```bash
git add src/lib/conversation-engine.ts
git commit -m "feat(lib): add conversation engine with scripted question trees per output type"
```

---

## Task 3: Studio Page — Server Shell

**Files:**
- Modify: `src/app/studio/page.tsx`

**Step 1: Replace placeholder with server shell**

```tsx
// src/app/studio/page.tsx
import { requireUser } from "@/lib/session";
import { StudioWizard } from "@/components/studio/StudioWizard";

export default async function StudioPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <p className="editorial-kicker">Studio</p>
        <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">
          Apa yang nak dibuat hari ni?
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          Pilih brand dan output — AI akan tanya soalan yang betul untuk hasilkan brief yang tepat.
        </p>
      </section>
      <StudioWizard userId={user.id} />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/studio/page.tsx
git commit -m "feat(studio): add studio page shell with StudioWizard entry point"
```

---

## Task 4: StudioWizard — State Machine

**Files:**
- Create: `src/components/studio/StudioWizard.tsx`

This is the main orchestrator. Manages stage transitions and accumulated brief data.

**Step 1: Create StudioWizard**

```tsx
// src/components/studio/StudioWizard.tsx
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

export function StudioWizard({ userId }: { userId: string }) {
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
    if (stage === "REVIEW") { setStage("CONVERSATION"); setCurrentQuestionIndex((outputType?.questions.length ?? 1) - 1); return; }
  }

  async function handleGenerate() {
    if (!brand || !outputType) return;
    setStage("GENERATING");
    setError(null);

    // Build product description from answers
    const product = answers["promo"] || answers["story"] || answers["objective"] || "content";

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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation gagal. Cuba semula.");
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

  // Progress: how far through the full wizard
  const progressSteps = ["Brand", "Output", "Brief", "Review"];
  const progressIndex =
    stage === "SELECT_BRAND" ? 0 :
    stage === "SELECT_OUTPUT" ? 1 :
    stage === "CONVERSATION" ? 2 :
    3;

  return (
    <div className="space-y-4">
      {/* Progress bar — hide on result */}
      {stage !== "RESULT" && stage !== "GENERATING" && (
        <div className="editorial-panel rounded-4xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-2">
              {progressSteps.map((label, i) => (
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
              style={{ width: `${((progressIndex) / (progressSteps.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Stage renderers */}
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
```

**Step 2: Commit**

```bash
git add src/components/studio/StudioWizard.tsx
git commit -m "feat(studio): add StudioWizard state machine orchestrator"
```

---

## Task 5: BrandPicker Component

**Files:**
- Create: `src/components/studio/BrandPicker.tsx`

**Step 1: Create component**

```tsx
// src/components/studio/BrandPicker.tsx
"use client";

import { useEffect, useState } from "react";
import type { BrandSummary } from "./StudioWizard";

export function BrandPicker({ onSelect }: { onSelect: (brand: BrandSummary) => void }) {
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/brand")
      .then((r) => r.json())
      .then((data) => { setBrands(data as BrandSummary[]); setLoading(false); })
      .catch(() => { setError("Gagal load brands. Reload page."); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="editorial-panel rounded-4xl p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="editorial-panel rounded-4xl p-8 text-center text-sm text-red-400">{error}</div>
    );
  }

  return (
    <div className="editorial-panel rounded-4xl p-6 sm:p-8 space-y-6">
      <div>
        <p className="editorial-kicker">Langkah 1</p>
        <h2 className="editorial-title mt-2 text-3xl sm:text-4xl">Pilih brand</h2>
        <p className="mt-2 text-sm editorial-muted">Output AI akan disesuaikan dengan guidelines brand yang dipilih.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {brands.map((brand) => (
          <button
            key={brand.id}
            type="button"
            onClick={() => onSelect(brand)}
            className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.02)] p-6 text-left transition hover:border-[rgba(212,183,143,0.4)] hover:bg-[rgba(255,255,255,0.04)]"
          >
            <div
              className="mb-4 h-2 w-12 rounded-full"
              style={{ backgroundColor: brand.primaryColor }}
            />
            <p className="text-lg font-semibold">{brand.name}</p>
            <p className="mt-1 text-sm editorial-muted">{brand.tagline}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/studio/BrandPicker.tsx
git commit -m "feat(studio): add BrandPicker component with API-loaded brands"
```

---

## Task 6: OutputTypePicker Component

**Files:**
- Create: `src/components/studio/OutputTypePicker.tsx`

**Step 1: Create component**

```tsx
// src/components/studio/OutputTypePicker.tsx
"use client";

import { OUTPUT_TYPES } from "@/lib/conversation-engine";
import type { BrandSummary } from "./StudioWizard";

const TEAM_LABELS: Record<string, string> = {
  marketing: "Team Marketing",
  creative: "Team Creative",
  video: "Team Video",
};

export function OutputTypePicker({
  brand,
  onSelect,
  onBack,
}: {
  brand: BrandSummary;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const grouped = OUTPUT_TYPES.reduce<Record<string, typeof OUTPUT_TYPES>>((acc, ot) => {
    if (!acc[ot.team]) acc[ot.team] = [];
    acc[ot.team].push(ot);
    return acc;
  }, {});

  return (
    <div className="editorial-panel rounded-4xl p-6 sm:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="editorial-kicker">Langkah 2 — {brand.name}</p>
          <h2 className="editorial-title mt-2 text-3xl sm:text-4xl">Apa yang nak dibuat?</h2>
          <p className="mt-2 text-sm editorial-muted">Pilih jenis output — AI akan tanya soalan yang berkaitan.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-full border border-white/10 px-4 py-2 text-sm editorial-muted hover:border-white/20 transition"
        >
          ← Tukar brand
        </button>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([team, types]) => (
          <div key={team}>
            <p className="mb-3 text-xs uppercase tracking-[0.2em] editorial-muted">{TEAM_LABELS[team]}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {types.map((ot) => (
                <button
                  key={ot.id}
                  type="button"
                  onClick={() => onSelect(ot.id)}
                  className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.02)] p-5 text-left transition hover:border-[rgba(212,183,143,0.4)] hover:bg-[rgba(255,255,255,0.04)]"
                >
                  <p className="font-semibold">{ot.label}</p>
                  <p className="mt-1 text-sm editorial-muted">{ot.description}</p>
                  <p className="mt-3 text-xs editorial-muted opacity-60">{ot.questions.length} soalan</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/studio/OutputTypePicker.tsx
git commit -m "feat(studio): add OutputTypePicker grouped by team role"
```

---

## Task 7: ConversationStep Component

**Files:**
- Create: `src/components/studio/ConversationStep.tsx`

This is the core of the wizard — one question at a time, chip selection + optional text input.

**Step 1: Create component**

```tsx
// src/components/studio/ConversationStep.tsx
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
  const [selected, setSelected] = useState<string>(existingAnswer ?? "");
  const [textValue, setTextValue] = useState<string>(() => {
    // If existing answer is not one of the chips, it was free text
    if (existingAnswer && question.options && !question.options.includes(existingAnswer)) {
      return existingAnswer;
    }
    return "";
  });

  const effectiveAnswer = textValue.trim() || selected;

  function handleChipClick(option: string) {
    setSelected((prev) => (prev === option ? "" : option));
    // Clear text if selecting a chip
    if (question.answerType === "chips") setTextValue("");
  }

  function handleSubmit() {
    const answer = textValue.trim() || selected;
    if (!answer && question.required) return;
    onAnswer(question.id, answer || "—");
  }

  return (
    <div className="editorial-panel rounded-4xl p-6 sm:p-8 space-y-6">
      {/* Context header */}
      <div className="flex items-center gap-2 text-xs editorial-muted">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: brand.primaryColor }}
        />
        <span>{brand.name}</span>
        <span>·</span>
        <span>{outputTypeLabel}</span>
        <span>·</span>
        <span>Soalan {questionNumber} dari {totalQuestions}</span>
      </div>

      {/* Question */}
      <div>
        <h2 className="editorial-title text-3xl sm:text-4xl">{question.text}</h2>
        {question.subtext && (
          <p className="mt-2 text-sm editorial-muted">{question.subtext}</p>
        )}
      </div>

      {/* Chips */}
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
                    : "border-white/10 bg-[rgba(255,255,255,0.02)] editorial-muted hover:border-white/20"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}

      {/* Text input (for chips+text or text only) */}
      {(question.answerType === "text" || question.answerType === "chips+text") && (
        <div>
          {question.answerType === "chips+text" && (
            <p className="mb-2 text-xs editorial-muted">Atau terangkan dengan lebih spesifik:</p>
          )}
          <textarea
            value={textValue}
            onChange={(e) => { setTextValue(e.target.value); if (e.target.value) setSelected(""); }}
            placeholder={question.placeholder}
            rows={3}
            className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm outline-none transition placeholder:text-muted focus:border-(--accent) resize-none"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-white/10 px-5 py-3 text-sm editorial-muted hover:border-white/20 transition"
        >
          ← Balik
        </button>

        {canSkip && !effectiveAnswer && (
          <button
            type="button"
            onClick={() => onAnswer(question.id, "—")}
            className="rounded-full border border-white/10 px-5 py-3 text-sm editorial-muted hover:border-white/20 transition"
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
```

**Step 2: Commit**

```bash
git add src/components/studio/ConversationStep.tsx
git commit -m "feat(studio): add ConversationStep with chip selection and text input"
```

---

## Task 8: BriefReview Component

**Files:**
- Create: `src/components/studio/BriefReview.tsx`

**Step 1: Create component**

```tsx
// src/components/studio/BriefReview.tsx
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
        <p className="mt-2 text-sm editorial-muted">Semak dan betulkan jika perlu sebelum generate.</p>
      </div>

      {/* Brief summary */}
      <div className="rounded-3xl border border-white/10 divide-y divide-white/10">
        {/* Brand row */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs editorial-muted uppercase tracking-[0.15em]">Brand</p>
            <p className="mt-1 text-sm font-medium">{brand.name}</p>
          </div>
        </div>
        {/* Output type row */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs editorial-muted uppercase tracking-[0.15em]">Output</p>
            <p className="mt-1 text-sm font-medium">{outputType.label}</p>
          </div>
        </div>
        {/* Answer rows */}
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
          className="rounded-full border border-white/10 px-5 py-3 text-sm editorial-muted hover:border-white/20 transition"
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
```

**Step 2: Commit**

```bash
git add src/components/studio/BriefReview.tsx
git commit -m "feat(studio): add BriefReview with editable answer summary"
```

---

## Task 9: GenerationResult Component

**Files:**
- Create: `src/components/studio/GenerationResult.tsx`

**Step 1: Create component**

```tsx
// src/components/studio/GenerationResult.tsx
"use client";

import type { OutputType } from "@/lib/conversation-engine";
import type { BrandSummary, GeneratedOutput } from "./StudioWizard";

export function GenerationResult({
  result,
  brand,
  outputType,
  answers,
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
      {/* Header */}
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

      {/* Output cards */}
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
```

**Step 2: Commit**

```bash
git add src/components/studio/GenerationResult.tsx
git commit -m "feat(studio): add GenerationResult with output cards and regenerate action"
```

---

## Task 10: Wire Brief Answers Into Generate API

The generate API needs to accept `briefAnswers` and include it in the AI prompt.

**Files:**
- Modify: `src/app/api/generate/route.ts`
- Modify: `src/lib/openai.ts`

**Step 1: Update GenerateBody type and pass briefAnswers to generateCopy**

In `route.ts`, add `briefAnswers` to the body type and pass to `generateCopy`.

In `openai.ts`, accept `briefAnswers` as optional param and append to userPrompt:

```ts
// In generateCopy signature:
export async function generateCopy(
  brand: BrandContext,
  product: string,
  contentType: string,
  variant: number,
  briefAnswers?: Record<string, string>
): Promise<GeneratedCopy>

// In userPrompt construction:
const briefBlock = briefAnswers
  ? "\n\nBrief dari user:\n" + Object.entries(briefAnswers)
      .filter(([, v]) => v && v !== "—")
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n")
  : "";

const userPrompt = `Create a ${contentType} about "${product}" for the ${brand.name} brand. Variant ${variant}. Follow the brand guidelines strictly.${briefBlock}`;
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
# Expected: no errors
```

**Step 3: Commit**

```bash
git add src/app/api/generate/route.ts src/lib/openai.ts
git commit -m "feat(api): pass briefAnswers into AI prompt for richer context"
```

---

## Task 11: Add Studio to Nav + Verify End-to-End

**Files:**
- Modify: `src/lib/dashboard-data.ts`

**Step 1: Add Studio to nav**

```ts
{ href: "/studio", label: "🎨 Studio", description: "AI-powered creative brief wizard" },
```

Add as the first item after Overview.

**Step 2: Start dev server and test full flow manually**

```bash
npm run dev
```

Test checklist:
- [ ] Navigate to `/studio`
- [ ] Brand picker loads SifuTutor and NakNgaji
- [ ] Pick SifuTutor → output type picker appears
- [ ] Pick Hook & Copy → conversation starts
- [ ] Answer all questions → review brief appears
- [ ] Edit one answer → goes back to that question
- [ ] Confirm → generating spinner
- [ ] Result appears with all fields populated
- [ ] Regenerate works
- [ ] "Baru" button resets to brand picker

**Step 3: Final commit**

```bash
git add src/lib/dashboard-data.ts
git commit -m "feat(nav): add Studio link to dashboard navigation"
```

---

## File Summary

| File | Action |
|------|--------|
| `src/app/api/brand/route.ts` | Create |
| `src/lib/conversation-engine.ts` | Create |
| `src/app/studio/page.tsx` | Modify |
| `src/components/studio/StudioWizard.tsx` | Create |
| `src/components/studio/BrandPicker.tsx` | Create |
| `src/components/studio/OutputTypePicker.tsx` | Create |
| `src/components/studio/ConversationStep.tsx` | Create |
| `src/components/studio/BriefReview.tsx` | Create |
| `src/components/studio/GenerationResult.tsx` | Create |
| `src/app/api/generate/route.ts` | Modify |
| `src/lib/openai.ts` | Modify |
| `src/lib/dashboard-data.ts` | Modify |

---

## Future: Option 2 Upgrade Path

When ready to upgrade to true AI conversation:
- Replace `conversation-engine.ts` question trees with a `POST /api/studio/next-question` endpoint
- AI decides next question based on previous answers
- `ConversationStep` becomes a chat bubble UI instead of chips
- Same `BriefReview` and `GenerationResult` components can stay as-is
