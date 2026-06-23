"use client";

import { useState } from "react";

// Two-step destructive action: first click arms, second confirms. No modal lib.
export function InlineConfirm({
  label = "Delete",
  confirmLabel = "Confirm",
  question = "Sure?",
  disabled,
  onConfirm,
}: {
  label?: string;
  confirmLabel?: string;
  question?: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setArmed(true)}
        className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40"
      >
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="text-[#7b8698]">{question}</span>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="rounded-lg border border-[var(--line-2)] px-2.5 py-1 font-medium text-[#33414f] transition hover:bg-[var(--card-2)]"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setArmed(false); onConfirm(); }}
        className="rounded-lg bg-red-600 px-2.5 py-1 font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
      >
        {confirmLabel}
      </button>
    </span>
  );
}
