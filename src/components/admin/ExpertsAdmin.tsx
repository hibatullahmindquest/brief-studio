"use client";

import { useState } from "react";
import { InlineConfirm } from "./InlineConfirm";

export type ExpertRow = {
  id: string;
  roleKey: string;
  name: string;
  systemPrompt: string;
  modelTier: string;
  enabled: boolean;
};

const TIERS: { v: string; label: string }[] = [
  { v: "fast", label: "Fast" },
  { v: "standard", label: "Standard" },
  { v: "premium", label: "Premium" },
];

type Draft = { roleKey: string; name: string; systemPrompt: string; modelTier: string; enabled: boolean };
const EMPTY: Draft = { roleKey: "", name: "", systemPrompt: "", modelTier: "standard", enabled: true };

type Msg = { kind: "ok" | "err"; text: string } | null;

export function ExpertsAdmin({ initial }: { initial: ExpertRow[] }) {
  const [experts, setExperts] = useState<ExpertRow[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null); // null = none; "new" = create panel
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  function openCreate() {
    setDraft(EMPTY);
    setEditingId("new");
    setMsg(null);
  }
  function openEdit(e: ExpertRow) {
    setDraft({ roleKey: e.roleKey, name: e.name, systemPrompt: e.systemPrompt, modelTier: e.modelTier, enabled: e.enabled });
    setEditingId(e.id);
    setMsg(null);
  }
  function close() {
    setEditingId(null);
    setDraft(EMPTY);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const isNew = editingId === "new";
      const url = isNew ? "/api/admin/experts" : `/api/admin/experts?id=${editingId}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as ExpertRow & { error?: string };
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Save failed." });
        return;
      }
      const row: ExpertRow = { id: data.id, roleKey: data.roleKey, name: data.name, systemPrompt: data.systemPrompt, modelTier: data.modelTier, enabled: data.enabled };
      setExperts((prev) => (isNew ? [...prev, row] : prev.map((e) => (e.id === row.id ? row : e))).sort((a, b) => a.name.localeCompare(b.name)));
      setMsg({ kind: "ok", text: "Saved." });
      close();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(e: ExpertRow) {
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/experts?id=${e.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !e.enabled }),
      });
      const data = (await res.json()) as ExpertRow & { error?: string };
      if (!res.ok) { setMsg({ kind: "err", text: data.error ?? "Update failed." }); return; }
      setExperts((prev) => prev.map((x) => (x.id === e.id ? { ...x, enabled: data.enabled } : x)));
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    }
  }

  async function remove(e: ExpertRow) {
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/experts?id=${e.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setMsg({ kind: "err", text: data.error ?? "Delete failed." }); return; }
      setExperts((prev) => prev.filter((x) => x.id !== e.id));
      setMsg({ kind: "ok", text: `Deleted ${e.name}.` });
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Experts</p>
          <p className="mt-1 text-xs text-[#7b8698]">{experts.length} total · {experts.filter((e) => !e.enabled).length} disabled</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-2)]"
        >
          + New expert
        </button>
      </div>

      {editingId === "new" && (
        <Editor draft={draft} setDraft={setDraft} saving={saving} onSave={save} onCancel={close} isNew />
      )}

      {experts.length === 0 && editingId !== "new" ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--line-2)] p-8 text-center">
          <p className="text-sm text-[#7b8698]">No experts yet.</p>
          <button type="button" onClick={openCreate} className="mt-3 rounded-xl border border-[var(--line-2)] px-4 py-2 text-sm font-semibold text-[#33414f] transition hover:bg-[var(--card-2)]">
            + Create the first expert
          </button>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {experts.map((e) => (
            <li key={e.id} className={`rounded-2xl border border-[var(--line)] p-4 ${e.enabled ? "" : "opacity-60"}`}>
              {editingId === e.id ? (
                <Editor draft={draft} setDraft={setDraft} saving={saving} onSave={save} onCancel={close} />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-[#00262a]">{e.name}</h3>
                      <code className="rounded bg-[var(--card-2)] px-1.5 py-0.5 font-mono text-[11px] text-[#33414f]">{e.roleKey}</code>
                      <span className="rounded-full border border-[var(--line-2)] px-2 py-0.5 text-[11px] text-[#7b8698]">{e.modelTier}</span>
                      {!e.enabled && <span className="rounded-full bg-[var(--card-2)] px-2 py-0.5 text-[11px] text-[#7b8698]">disabled</span>}
                    </div>
                    <p className="mt-1 text-xs text-[#a6aebb]">{e.systemPrompt.length} chars{e.systemPrompt.trim() === "" && e.enabled ? " · ⚠ empty prompt" : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => toggleEnabled(e)} className="rounded-lg border border-[var(--line-2)] px-2.5 py-1 text-xs font-medium text-[#33414f] transition hover:bg-[var(--card-2)]">
                      {e.enabled ? "Disable" : "Enable"}
                    </button>
                    <button type="button" onClick={() => openEdit(e)} className="rounded-lg border border-[var(--line-2)] px-2.5 py-1 text-xs font-medium text-[#33414f] transition hover:bg-[var(--card-2)]">
                      Edit
                    </button>
                    <InlineConfirm question={`Delete ${e.name}?`} onConfirm={() => remove(e)} />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {msg && (
        <p className={`mt-4 rounded-xl border p-3 text-sm ${msg.kind === "ok" ? "border-[var(--ok)] bg-[var(--ok-soft)] text-[var(--ok)]" : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}

function Editor({
  draft, setDraft, saving, onSave, onCancel, isNew,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
}) {
  const emptyPromptWarn = draft.enabled && draft.systemPrompt.trim() === "";
  return (
    <div className={`${isNew ? "mt-5" : ""} rounded-2xl border border-[var(--brand)] bg-[var(--brand-soft)]/30 p-4`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-[#7b8698]">Name</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Art Director"
            className="mt-1 w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[#00262a] outline-none focus:border-[var(--brand)]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[#7b8698]">roleKey</span>
          <input
            value={draft.roleKey}
            onChange={(e) => setDraft({ ...draft, roleKey: e.target.value })}
            placeholder="art_director"
            className="mt-1 w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 font-mono text-sm text-[#00262a] outline-none focus:border-[var(--brand)]"
          />
          <span className="mt-1 block text-[11px] text-[#a6aebb]">
            unique · lowercase · letters/digits/underscore{!isNew ? " · changing it can break recipes that reference it" : ""}
          </span>
        </label>
      </div>

      <div className="mt-3">
        <span className="text-xs font-medium text-[#7b8698]">Model tier</span>
        <div className="mt-1.5 flex gap-2">
          {TIERS.map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => setDraft({ ...draft, modelTier: t.v })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                draft.modelTier === t.v ? "border-[var(--brand)] bg-[var(--brand-soft)] text-foreground" : "border-[var(--line-2)] text-[#7b8698] hover:bg-[var(--card-2)]"
              }`}
            >
              {t.label}
            </button>
          ))}
          <label className="ml-auto inline-flex items-center gap-2 text-xs text-[#7b8698]">
            <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
            Enabled
          </label>
        </div>
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-[#7b8698]">System prompt</span>
        <textarea
          value={draft.systemPrompt}
          onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
          rows={14}
          placeholder="You are the Art Director. Given the brief and prior expert outputs, produce…"
          className="mt-1 w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 font-mono text-[13px] leading-6 text-[#00262a] outline-none focus:border-[var(--brand)]"
        />
        <span className="mt-1 block text-[11px] text-[#a6aebb]">
          {draft.systemPrompt.length} chars{emptyPromptWarn ? " · ⚠ enabled expert with an empty prompt will produce poor output" : ""}
        </span>
      </label>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-2)] disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[var(--line-2)] px-4 py-2 text-sm font-medium text-[#33414f] transition hover:bg-[var(--card-2)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
