"use client";

import { useState } from "react";
import { InlineConfirm } from "./InlineConfirm";
import { ChipListInput } from "./ChipListInput";
import { RecipeStepsBuilder, type RecipeStep, type ExpertOption } from "./RecipeStepsBuilder";

export type RecipeRow = {
  id: string;
  taskType: string;
  group: string;
  steps: RecipeStep[];
  outputFormat: string;
  lenses: string[];
  enabled: boolean;
};

const GROUPS = ["", "creative", "copy", "strategy", "intelligence", "compound"] as const;
const OUTPUT_FORMATS = ["", "image", "text", "pdf", "carousel"] as const;
const LENS_SUGGESTIONS = ["marketing", "social", "social_memo", "strategy", "intelligence"];

type Draft = {
  taskType: string;
  group: string;
  outputFormat: string;
  lenses: string[];
  enabled: boolean;
  steps: RecipeStep[];
};
const EMPTY: Draft = { taskType: "", group: "", outputFormat: "", lenses: [], enabled: true, steps: [] };

type Msg = { kind: "ok" | "err"; text: string } | null;

// Serialise editor rows → steps Json: drop modelTier when "inherit" (empty).
function serializeSteps(steps: RecipeStep[]): RecipeStep[] {
  return steps.map((s) =>
    s.modelTier && s.modelTier !== "" ? { roleKey: s.roleKey, modelTier: s.modelTier } : { roleKey: s.roleKey },
  );
}

function toRow(data: RecipeRow & { steps?: unknown; lenses?: unknown }): RecipeRow {
  return {
    id: data.id,
    taskType: data.taskType,
    group: data.group ?? "",
    outputFormat: data.outputFormat ?? "",
    enabled: data.enabled,
    lenses: Array.isArray(data.lenses) ? (data.lenses as string[]) : [],
    steps: Array.isArray(data.steps) ? (data.steps as RecipeStep[]) : [],
  };
}

export function RecipesAdmin({ initial, experts }: { initial: RecipeRow[]; experts: ExpertOption[] }) {
  const [recipes, setRecipes] = useState<RecipeRow[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null); // null = none; "new" = create panel
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const expertName = new Map(experts.map((e) => [e.roleKey, e]));

  function openCreate() {
    setDraft(EMPTY);
    setEditingId("new");
    setMsg(null);
  }
  function openEdit(r: RecipeRow) {
    setDraft({
      taskType: r.taskType,
      group: r.group,
      outputFormat: r.outputFormat,
      lenses: [...r.lenses],
      enabled: r.enabled,
      steps: r.steps.map((s) => ({ ...s })),
    });
    setEditingId(r.id);
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
      const url = isNew ? "/api/admin/recipes" : `/api/admin/recipes?id=${editingId}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: draft.taskType,
          group: draft.group,
          outputFormat: draft.outputFormat,
          lenses: draft.lenses,
          enabled: draft.enabled,
          steps: serializeSteps(draft.steps),
        }),
      });
      const data = (await res.json()) as RecipeRow & { error?: string };
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Save failed." });
        return;
      }
      const row = toRow(data);
      setRecipes((prev) =>
        (isNew ? [...prev, row] : prev.map((r) => (r.id === row.id ? row : r))).sort((a, b) =>
          a.taskType.localeCompare(b.taskType),
        ),
      );
      setMsg({ kind: "ok", text: "Saved." });
      close();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(r: RecipeRow) {
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/recipes?id=${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !r.enabled }),
      });
      const data = (await res.json()) as RecipeRow & { error?: string };
      if (!res.ok) { setMsg({ kind: "err", text: data.error ?? "Update failed." }); return; }
      setRecipes((prev) => prev.map((x) => (x.id === r.id ? { ...x, enabled: data.enabled } : x)));
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    }
  }

  async function remove(r: RecipeRow) {
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/recipes?id=${r.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setMsg({ kind: "err", text: data.error ?? "Delete failed." }); return; }
      setRecipes((prev) => prev.filter((x) => x.id !== r.id));
      setMsg({ kind: "ok", text: `Deleted ${r.taskType}.` });
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Recipes</p>
          <p className="mt-1 text-xs text-[#7b8698]">{recipes.length} total · {recipes.filter((r) => !r.enabled).length} disabled</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-2)]"
        >
          + New recipe
        </button>
      </div>

      {editingId === "new" && (
        <Editor draft={draft} setDraft={setDraft} experts={experts} saving={saving} onSave={save} onCancel={close} isNew />
      )}

      {recipes.length === 0 && editingId !== "new" ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--line-2)] p-8 text-center">
          <p className="text-sm text-[#7b8698]">No recipes yet.</p>
          <button type="button" onClick={openCreate} className="mt-3 rounded-xl border border-[var(--line-2)] px-4 py-2 text-sm font-semibold text-[#33414f] transition hover:bg-[var(--card-2)]">
            + Create the first recipe
          </button>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {recipes.map((r) => (
            <li key={r.id} className={`rounded-2xl border border-[var(--line)] p-4 ${r.enabled ? "" : "opacity-60"}`}>
              {editingId === r.id ? (
                <Editor draft={draft} setDraft={setDraft} experts={experts} saving={saving} onSave={save} onCancel={close} />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-[var(--card-2)] px-1.5 py-0.5 font-mono text-[13px] font-semibold text-[#00262a]">{r.taskType}</code>
                      {r.group && <span className="rounded-full border border-[var(--line-2)] px-2 py-0.5 text-[11px] text-[#7b8698]">{r.group}</span>}
                      {r.outputFormat && <span className="rounded-full border border-[var(--line-2)] px-2 py-0.5 text-[11px] text-[#7b8698]">{r.outputFormat}</span>}
                      {!r.enabled && <span className="rounded-full bg-[var(--card-2)] px-2 py-0.5 text-[11px] text-[#7b8698]">disabled</span>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-[#a6aebb]">{r.steps.length} step{r.steps.length === 1 ? "" : "s"}:</span>
                      {r.steps.map((s, i) => {
                        const e = expertName.get(s.roleKey);
                        const warn = !e || !e.enabled;
                        return (
                          <span
                            key={i}
                            className={`rounded-full px-2 py-0.5 text-[11px] ${warn ? "bg-red-50 text-red-600" : "bg-[var(--card-2)] text-[#33414f]"}`}
                          >
                            {i + 1}. {e?.name ?? s.roleKey}{warn ? " ⚠" : ""}
                          </span>
                        );
                      })}
                    </div>
                    {r.lenses.length > 0 && (
                      <p className="mt-1 text-[11px] text-[#a6aebb]">lenses: {r.lenses.join(", ")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => toggleEnabled(r)} className="rounded-lg border border-[var(--line-2)] px-2.5 py-1 text-xs font-medium text-[#33414f] transition hover:bg-[var(--card-2)]">
                      {r.enabled ? "Disable" : "Enable"}
                    </button>
                    <button type="button" onClick={() => openEdit(r)} className="rounded-lg border border-[var(--line-2)] px-2.5 py-1 text-xs font-medium text-[#33414f] transition hover:bg-[var(--card-2)]">
                      Edit
                    </button>
                    <InlineConfirm question={`Delete ${r.taskType}?`} onConfirm={() => remove(r)} />
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
  draft, setDraft, experts, saving, onSave, onCancel, isNew,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  experts: ExpertOption[];
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
}) {
  return (
    <div className={`${isNew ? "mt-5" : ""} rounded-2xl border border-[var(--brand)] bg-[var(--brand-soft)]/30 p-4`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-[#7b8698]">Task type</span>
          <input
            value={draft.taskType}
            onChange={(e) => setDraft({ ...draft, taskType: e.target.value })}
            placeholder="poster"
            className="mt-1 w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 font-mono text-sm text-[#00262a] outline-none focus:border-[var(--brand)]"
          />
          <span className="mt-1 block text-[11px] text-[#a6aebb]">unique · lowercase · letters/digits/underscore</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-[#7b8698]">Group</span>
            <select
              value={draft.group}
              onChange={(e) => setDraft({ ...draft, group: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[#00262a] outline-none focus:border-[var(--brand)]"
            >
              {GROUPS.map((g) => (
                <option key={g} value={g}>{g === "" ? "—" : g}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#7b8698]">Output</span>
            <select
              value={draft.outputFormat}
              onChange={(e) => setDraft({ ...draft, outputFormat: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[#00262a] outline-none focus:border-[var(--brand)]"
            >
              {OUTPUT_FORMATS.map((f) => (
                <option key={f} value={f}>{f === "" ? "—" : f}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-3">
        <ChipListInput
          label="Lenses"
          values={draft.lenses}
          onChange={(lenses) => setDraft({ ...draft, lenses })}
          placeholder="Add a lens and press Enter"
          suggestions={LENS_SUGGESTIONS}
        />
      </div>

      <div className="mt-3">
        <RecipeStepsBuilder
          steps={draft.steps}
          experts={experts}
          onChange={(steps) => setDraft({ ...draft, steps })}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-xs text-[#7b8698]">
          <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
          Enabled
        </label>
      </div>

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
