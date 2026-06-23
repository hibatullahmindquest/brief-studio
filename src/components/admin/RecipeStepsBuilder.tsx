"use client";

export type RecipeStep = { roleKey: string; modelTier?: string };
export type ExpertOption = { roleKey: string; name: string; enabled: boolean };

// Tier override options. "" = inherit the expert's own tier (omitted on serialise).
const TIER_OPTS: { v: string; label: string }[] = [
  { v: "", label: "inherit" },
  { v: "fast", label: "fast" },
  { v: "standard", label: "standard" },
  { v: "premium", label: "premium" },
];

// Ordered expert lineup. Rows reorder via ▲▼, expert picked from a select of
// enabled experts; a saved step whose roleKey is now disabled/unknown still shows
// (kept editable) with a red ⚠. Parent serialises rows → steps Json.
export function RecipeStepsBuilder({
  steps,
  experts,
  onChange,
}: {
  steps: RecipeStep[];
  experts: ExpertOption[];
  onChange: (next: RecipeStep[]) => void;
}) {
  const enabled = experts.filter((e) => e.enabled);
  const byKey = new Map(experts.map((e) => [e.roleKey, e]));

  function update(i: number, patch: Partial<RecipeStep>) {
    onChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function remove(i: number) {
    onChange(steps.filter((_, idx) => idx !== i));
  }
  function add() {
    const first = enabled[0]?.roleKey ?? "";
    onChange([...steps, { roleKey: first }]);
  }

  return (
    <div>
      <span className="text-xs font-medium text-[#7b8698]">Expert lineup (runs in order)</span>
      <div className="mt-1.5 space-y-2 rounded-2xl border border-[var(--line-2)] bg-[var(--card-2)]/40 p-3">
        {steps.length === 0 && (
          <p className="px-1 py-2 text-xs text-[#a6aebb]">No steps yet — add at least one expert.</p>
        )}
        {steps.map((s, i) => {
          const expert = byKey.get(s.roleKey);
          const missing = !expert; // unknown roleKey
          const disabled = !!expert && !expert.enabled;
          const warn = missing || disabled;
          return (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-white p-2">
              <span className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="leading-none text-[#a6aebb] transition hover:text-[#33414f] disabled:opacity-30"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === steps.length - 1}
                  className="leading-none text-[#a6aebb] transition hover:text-[#33414f] disabled:opacity-30"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </span>
              <span className="w-5 text-center text-xs font-semibold text-[#7b8698]">{i + 1}</span>

              <select
                value={s.roleKey}
                onChange={(e) => update(i, { roleKey: e.target.value })}
                className={`min-w-[10rem] flex-1 rounded-lg border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--brand)] ${
                  warn ? "border-red-300 text-red-700" : "border-[var(--line-2)] text-[#00262a]"
                }`}
              >
                {/* Keep the current value selectable even if disabled/unknown. */}
                {warn && (
                  <option value={s.roleKey}>
                    {missing ? `${s.roleKey} (unknown)` : `${expert?.name} (disabled)`}
                  </option>
                )}
                {enabled.map((e) => (
                  <option key={e.roleKey} value={e.roleKey}>
                    {e.name}
                  </option>
                ))}
              </select>

              <label className="inline-flex items-center gap-1 text-[11px] text-[#7b8698]">
                tier
                <select
                  value={s.modelTier ?? ""}
                  onChange={(e) => update(i, { modelTier: e.target.value })}
                  className="rounded-lg border border-[var(--line-2)] bg-white px-2 py-1.5 text-xs text-[#33414f] outline-none focus:border-[var(--brand)]"
                >
                  {TIER_OPTS.map((t) => (
                    <option key={t.v} value={t.v}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                aria-label="Remove step"
              >
                ✕
              </button>

              {warn && (
                <p className="w-full px-1 text-[11px] text-red-600">
                  ⚠ {missing ? "Unknown expert — roleKey not found." : "This expert is disabled."} Pick a replacement or re-enable it.
                </p>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={add}
          disabled={enabled.length === 0}
          className="rounded-xl border border-dashed border-[var(--line-2)] px-3 py-1.5 text-xs font-semibold text-[#33414f] transition hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-40"
        >
          + Add expert
        </button>
        {enabled.length === 0 && (
          <p className="px-1 text-[11px] text-[#a6aebb]">No enabled experts — create one under Settings / Experts first.</p>
        )}
      </div>
    </div>
  );
}
