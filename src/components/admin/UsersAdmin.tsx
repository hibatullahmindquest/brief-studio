"use client";

import { useState } from "react";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  teamRole: string;
  team: string;
  isAdmin: boolean;
};

const TEAM_ROLES: { v: string; label: string }[] = [
  { v: "marketing", label: "Marketing" },
  { v: "creative", label: "Creative" },
];

const TEAMS: { v: string; label: string }[] = [
  { v: "single", label: "Single" },
  { v: "multi", label: "Multi (HOD)" },
  { v: "all", label: "All (admin)" },
];

type Assignment = { teamRole: string; team: string; isAdmin: boolean };
type Msg = { kind: "ok" | "err"; text: string } | null;

const pick = (u: UserRow): Assignment => ({ teamRole: u.teamRole, team: u.team, isAdmin: u.isAdmin });
const dirty = (a: Assignment, b: Assignment) => a.teamRole !== b.teamRole || a.team !== b.team || a.isAdmin !== b.isAdmin;

const selectCls =
  "rounded-lg border border-[var(--line-2)] bg-white px-2.5 py-1.5 text-sm text-[#00262a] outline-none focus:border-[var(--brand)]";

export function UsersAdmin({ initial, selfId }: { initial: UserRow[]; selfId: string }) {
  // Server truth per row; drafts/saving/messages keyed by user id.
  const [saved, setSaved] = useState<Record<string, UserRow>>(() => Object.fromEntries(initial.map((u) => [u.id, u])));
  const [drafts, setDrafts] = useState<Record<string, Assignment>>(() => Object.fromEntries(initial.map((u) => [u.id, pick(u)])));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, Msg>>({});

  const rows = initial.map((u) => saved[u.id] ?? u);
  const adminCount = rows.filter((u) => u.isAdmin).length;

  function patchDraft(id: string, patch: Partial<Assignment>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setMsgs((prev) => ({ ...prev, [id]: null }));
  }

  async function save(id: string) {
    const draft = drafts[id];
    setSavingId(id);
    setMsgs((prev) => ({ ...prev, [id]: null }));
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as UserRow & { error?: string };
      if (!res.ok) {
        setMsgs((prev) => ({ ...prev, [id]: { kind: "err", text: data.error ?? "Save failed." } }));
        return;
      }
      const row: UserRow = { id: data.id, name: data.name, email: data.email, teamRole: data.teamRole, team: data.team, isAdmin: data.isAdmin };
      setSaved((prev) => ({ ...prev, [id]: row }));
      setDrafts((prev) => ({ ...prev, [id]: pick(row) }));
      setMsgs((prev) => ({ ...prev, [id]: { kind: "ok", text: "Saved." } }));
    } catch {
      setMsgs((prev) => ({ ...prev, [id]: { kind: "err", text: "Network error." } }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Team</p>
          <p className="mt-1 text-xs text-[#7b8698]">{rows.length} users · {adminCount} admin{adminCount === 1 ? "" : "s"}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--line-2)] p-8 text-center">
          <p className="text-sm text-[#7b8698]">No users yet.</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((u) => {
            const draft = drafts[u.id] ?? pick(u);
            const isSelf = u.id === selfId;
            const isDirty = dirty(draft, pick(u));
            const msg = msgs[u.id] ?? null;
            return (
              <li
                key={u.id}
                className={`rounded-2xl border p-4 ${isSelf ? "border-[var(--brand)] bg-[var(--brand-soft)]/30" : "border-[var(--line)]"}`}
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-[#00262a]">{u.name}</h3>
                      {isSelf && <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand)]">you</span>}
                      {u.isAdmin && <span className="rounded-full border border-[var(--line-2)] px-2 py-0.5 text-[11px] text-[#7b8698]">admin</span>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#a6aebb]">{u.email}</p>
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-[#7b8698]">Role</span>
                    <select value={draft.teamRole} onChange={(e) => patchDraft(u.id, { teamRole: e.target.value })} className={selectCls}>
                      {TEAM_ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-[#7b8698]">Team</span>
                    <select value={draft.team} onChange={(e) => patchDraft(u.id, { team: e.target.value })} className={selectCls}>
                      {TEAMS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                    </select>
                  </label>

                  <label className="flex items-center gap-2 self-end pb-1.5 text-xs text-[#33414f]">
                    <input type="checkbox" checked={draft.isAdmin} onChange={(e) => patchDraft(u.id, { isAdmin: e.target.checked })} />
                    Admin
                  </label>

                  <button
                    type="button"
                    onClick={() => save(u.id)}
                    disabled={!isDirty || savingId === u.id}
                    className="self-end rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-2)] disabled:opacity-40"
                  >
                    {savingId === u.id ? "Saving…" : "Save"}
                  </button>
                </div>

                {msg && (
                  <p className={`mt-3 rounded-lg border p-2 text-xs ${msg.kind === "ok" ? "border-[var(--ok)] bg-[var(--ok-soft)] text-[var(--ok)]" : "border-red-200 bg-red-50 text-red-700"}`}>
                    {msg.text}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
