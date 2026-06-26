"use client";

// Phase G — the brief bar. Horizontal chips that fill progressively as the flow advances:
// Task/Format land at intake; Objective/Angle from gap answers (Understand); Style/Mood/Colors
// from the visual direction (Visual). Empty chips render dimmed.

export type BriefFields = {
  task?: string;
  objective?: string;
  angle?: string;
  format?: string;
  style?: string;
  mood?: string;
  colors?: string;
};

const CHIPS: { key: keyof BriefFields; label: string; accent?: boolean }[] = [
  { key: "task", label: "Task" },
  { key: "objective", label: "Objective" },
  { key: "angle", label: "Angle", accent: true },
  { key: "format", label: "Format" },
  { key: "style", label: "Style" },
  { key: "mood", label: "Mood" },
  { key: "colors", label: "Colors" },
];

export function BriefBar({ fields }: { fields: BriefFields }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--card)] px-3 py-2">
      {CHIPS.map((c) => {
        const value = fields[c.key]?.trim();
        const filled = !!value;
        return (
          <span
            key={c.key}
            title={c.label}
            className={`inline-flex max-w-[180px] items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
              filled
                ? c.accent
                  ? "bg-[var(--orange-soft)] text-[var(--orange-2)]"
                  : "bg-[var(--brand-soft)] text-[var(--brand)]"
                : "bg-[var(--card-2)] text-[var(--muted)] opacity-60"
            }`}
          >
            <span className="mono text-[9px] uppercase tracking-[0.12em] opacity-70">{c.label}</span>
            {filled && <span className="truncate font-medium">{value}</span>}
          </span>
        );
      })}
    </div>
  );
}
