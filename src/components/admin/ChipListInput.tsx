"use client";

import { useState } from "react";

// Shared chip-list editor: type + Enter (or comma) to add, ✕ to remove. Optional
// suggestion buttons and a "danger" tone (red-tinted chips, e.g. brand do-not list).
// Used by recipe lenses here; reused by the brand knowledge form (P5).
export function ChipListInput({
  label,
  values,
  onChange,
  placeholder = "Type and press Enter",
  suggestions = [],
  helper,
  tone = "default",
}: {
  label?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  helper?: string;
  tone?: "default" | "danger";
}) {
  const [text, setText] = useState("");

  function add(raw: string) {
    const t = raw.trim();
    if (!t || values.includes(t)) return;
    onChange([...values, t]);
  }
  function commit() {
    if (text.trim()) {
      add(text);
      setText("");
    }
  }
  function remove(v: string) {
    onChange(values.filter((x) => x !== v));
  }

  const openSuggestions = suggestions.filter((s) => !values.includes(s));
  const chipClass =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-[var(--line-2)] bg-[var(--card-2)] text-[#33414f]";

  return (
    <div className="block">
      {label && <span className="text-xs font-medium text-[#7b8698]">{label}</span>}
      <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line-2)] bg-white p-2 focus-within:border-[var(--brand)]">
        {values.map((v) => (
          <span key={v} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${chipClass}`}>
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              className="text-[#a6aebb] transition hover:text-red-600"
              aria-label={`Remove ${v}`}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && text === "" && values.length > 0) {
              remove(values[values.length - 1]);
            }
          }}
          onBlur={commit}
          placeholder={values.length === 0 ? placeholder : ""}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-[#00262a] outline-none"
        />
      </div>
      {openSuggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {openSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-[var(--line-2)] px-2 py-0.5 text-[11px] text-[#7b8698] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
      {helper && <span className="mt-1 block text-[11px] text-[#a6aebb]">{helper}</span>}
    </div>
  );
}
