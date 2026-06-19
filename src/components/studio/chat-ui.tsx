"use client";

import { useState, type ReactNode } from "react";

// Shared chat primitives for the conversational Studio (brand/output picks,
// guided poster brief, and the generic per-output Q&A all use these).

export function ChatBubble({ role, children, bare }: { role: "ai" | "user"; children: ReactNode; bare?: boolean }) {
  const isAi = role === "ai";
  return (
    <div className={`flex gap-2.5 ${isAi ? "" : "flex-row-reverse"}`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
        isAi ? "bg-[var(--brand)] text-white" : "bg-[var(--card-2)] text-[#33414f]"
      }`}>
        {isAi ? "AI" : "H"}
      </span>
      <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
        bare ? "w-full bg-white ring-1 ring-[var(--line)]" : isAi ? "bg-[var(--card-2)] text-[#33414f]" : "bg-[var(--brand)] text-white"
      }`}>
        {children}
      </div>
    </div>
  );
}

export function TypingDots({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pl-11 text-xs text-[#7b8698]">
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--line-2)] border-t-[var(--brand)]" />
      {label}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active ? "border-[var(--brand)] bg-[var(--brand-soft)] text-foreground" : "border-[var(--line-2)] text-[#7b8698] hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

// "Tulis sendiri" chip → inline text input that commits on Enter/blur.
export function CustomChip({ label, onSet }: { label: string; onSet: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  if (open) {
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { onSet(val.trim()); setOpen(false); setVal(""); } }}
        onBlur={() => { if (val.trim()) onSet(val.trim()); setOpen(false); setVal(""); }}
        placeholder="Taip…"
        className="w-28 rounded-full border border-[var(--brand)] bg-white px-3 py-1.5 text-xs text-[#00262a] outline-none"
      />
    );
  }
  return (
    <button onClick={() => setOpen(true)} className="rounded-full border border-dashed border-[var(--line-2)] px-3 py-1.5 text-xs font-medium text-[#7b8698] hover:bg-white">
      ✎ {label}
    </button>
  );
}
