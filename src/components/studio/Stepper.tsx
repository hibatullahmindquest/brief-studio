"use client";

// Phase G — the 4-step progress rail. Pure presentation: given the active step it marks earlier
// steps done, the active one "now", later ones upcoming. (Text-first flow: the image is rendered
// on demand from the Result, so there is no separate Visual step.)

export type StepKey = "describe" | "understand" | "generating" | "result";

const ALL: { key: StepKey; label: string }[] = [
  { key: "describe", label: "Describe" },
  { key: "understand", label: "Understand" },
  { key: "generating", label: "Generate" },
  { key: "result", label: "Result" },
];

export const STEP_ORDER: StepKey[] = ALL.map((s) => s.key);

export function Stepper({ active }: { active: StepKey }) {
  const steps = ALL;
  const activeIdx = steps.findIndex((s) => s.key === active);

  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto py-1" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < activeIdx;
        const now = i === activeIdx;
        return (
          <li key={s.key} className="flex items-center gap-1.5">
            <div
              aria-current={now ? "step" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                now
                  ? "bg-[var(--brand)] text-white"
                  : done
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "bg-[var(--card-2)] text-[var(--muted)]"
              }`}
            >
              <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${now ? "bg-white/25" : done ? "bg-[var(--brand)] text-white" : "bg-[var(--line-2)] text-white"}`}>
                {done ? "✓" : i + 1}
              </span>
              <span className="whitespace-nowrap">{s.label}</span>
            </div>
            {i < steps.length - 1 && <span className="h-px w-3 bg-[var(--line-2)]" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
