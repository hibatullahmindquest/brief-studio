"use client";

import { useState, useEffect } from "react";

const STAGES = ["Planning", "Testing", "Active", "Scaling", "Paused", "Done"];
const CHANNELS = [
  "Instagram",
  "TikTok",
  "Instagram + TikTok",
  "Meta Ads",
  "Instagram + Meta Ads",
  "Reels + Stories",
  "YouTube",
  "Email",
  "LinkedIn",
  "Twitter / X",
  "Organic (All Channels)",
  "Other",
];

const STAGE_COLOURS: Record<string, string> = {
  Planning: "border-white/20 text-white/60",
  Testing: "border-yellow-500/40 text-yellow-300 bg-yellow-500/10",
  Active: "border-blue-500/40 text-blue-300 bg-blue-500/10",
  Scaling: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
  Paused: "border-orange-500/40 text-orange-300 bg-orange-500/10",
  Done: "border-white/10 text-white/30",
};

type Campaign = {
  id: string;
  name: string;
  channel: string;
  stage: string;
  budget: string;
  roi: string;
  goal: string;
  notes: string;
};

const DEFAULT_FORM: Omit<Campaign, "id"> = {
  name: "",
  channel: "Instagram",
  stage: "Planning",
  budget: "",
  roi: "",
  goal: "",
  notes: "",
};

export default function DashboardCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Campaign, "id">>(DEFAULT_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState("All");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    void loadCampaigns();
  }, []);

  async function loadCampaigns() {
    setLoading(true);
    setApiError("");
    try {
      const res = await fetch("/api/campaigns", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { campaigns: Campaign[] };
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setApiError("");
    try {
      if (editId) {
        const res = await fetch(`/api/campaigns/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { campaign: Campaign };
        setCampaigns((prev) => prev.map((c) => (c.id === editId ? data.campaign : c)));
        setEditId(null);
      } else {
        const res = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { campaign: Campaign };
        setCampaigns((prev) => [data.campaign, ...prev]);
      }

      setForm(DEFAULT_FORM);
      setShowForm(false);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to save campaign");
    }
  }

  function startEdit(c: Campaign) {
    setForm({
      name: c.name,
      channel: c.channel,
      stage: c.stage,
      budget: c.budget,
      roi: c.roi,
      goal: c.goal,
      notes: c.notes,
    });
    setEditId(c.id);
    setShowForm(true);
    setExpandedId(null);
  }

  async function remove(id: string) {
    setApiError("");
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to delete campaign");
    }
  }

  const filtered =
    filterStage === "All"
      ? campaigns
      : campaigns.filter((c) => c.stage === filterStage);

  const activeCount = campaigns.filter(
    (c) => c.stage === "Active" || c.stage === "Scaling"
  ).length;

  const totalBudget = campaigns
    .map((c) => parseFloat(c.budget.replace(/[^0-9.]/g, "") || "0"))
    .reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="editorial-kicker">Campaigns</p>
            <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">Your launch board</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
              Track every campaign you run — channels, budgets, goals, and ROI — all in one
              place.
            </p>
          </div>
          <button
            onClick={() => {
              setEditId(null);
              setForm(DEFAULT_FORM);
              setShowForm(true);
            }}
            className="editorial-button editorial-button-primary shrink-0 self-start"
          >
            + New campaign
          </button>
        </div>

        {campaigns.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-2.5">
              <p className="text-xs editorial-muted uppercase tracking-widest">Total</p>
              <p className="mt-1 text-xl font-semibold">{campaigns.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-2.5">
              <p className="text-xs text-emerald-400/70 uppercase tracking-widest">Live now</p>
              <p className="mt-1 text-xl font-semibold text-emerald-300">{activeCount}</p>
            </div>
            {totalBudget > 0 && (
              <div className="rounded-2xl border border-blue-500/25 bg-blue-500/5 px-4 py-2.5">
                <p className="text-xs text-blue-400/70 uppercase tracking-widest">Monthly spend</p>
                <p className="mt-1 text-xl font-semibold text-blue-300">
                  ${totalBudget.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {apiError && (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {apiError}
        </section>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <section className="editorial-panel rounded-4xl p-6">
          <h2 className="editorial-title text-2xl mb-6">
            {editId ? "Edit campaign" : "New campaign"}
          </h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-3">
              <label className="text-xs uppercase tracking-[0.15em] editorial-muted">
                Campaign name *
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Summer Drop Launch, Creator UGC Push…"
                className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] transition"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.15em] editorial-muted">Channel</label>
              <select
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                className="rounded-2xl border border-white/10 bg-[rgba(24,24,24,0.95)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] transition appearance-none"
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.15em] editorial-muted">Stage</label>
              <select
                value={form.stage}
                onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
                className="rounded-2xl border border-white/10 bg-[rgba(24,24,24,0.95)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] transition appearance-none"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.15em] editorial-muted">
                Budget / spend
              </label>
              <input
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                placeholder="e.g. $500/mo, Organic"
                className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] transition"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.15em] editorial-muted">
                ROI / result
              </label>
              <input
                value={form.roi}
                onChange={(e) => setForm((f) => ({ ...f, roi: e.target.value }))}
                placeholder="e.g. 3.2x, 120 leads, +500 followers"
                className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] transition"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.15em] editorial-muted">Goal</label>
              <input
                value={form.goal}
                onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                placeholder="e.g. 1000 new followers, £5k revenue"
                className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] transition"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-3">
              <label className="text-xs uppercase tracking-[0.15em] editorial-muted">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Strategy notes, links, next steps…"
                rows={3}
                className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] transition resize-none"
              />
            </div>
            <div className="flex gap-3 sm:col-span-2 xl:col-span-3">
              <button type="submit" className="editorial-button editorial-button-primary">
                {editId ? "Save changes" : "Add campaign"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditId(null);
                }}
                className="editorial-button editorial-button-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Filter tabs */}
      {campaigns.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {["All", ...STAGES].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStage(s)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                filterStage === s
                  ? "border-[rgba(212,183,143,0.5)] bg-[rgba(212,183,143,0.1)] text-[rgba(212,183,143,0.9)]"
                  : "border-white/10 editorial-muted hover:border-white/25"
              }`}
            >
              {s}
              {s !== "All" && campaigns.filter((c) => c.stage === s).length > 0 && (
                <span className="ml-1.5 opacity-60">
                  {campaigns.filter((c) => c.stage === s).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Campaign cards */}
      {loading ? (
        <section className="editorial-panel rounded-4xl p-10 text-center">
          <p className="text-sm editorial-muted">Loading campaigns...</p>
        </section>
      ) : filtered.length === 0 ? (
        <section className="editorial-panel rounded-4xl p-12 text-center">
          <p className="text-4xl mb-4">{campaigns.length === 0 ? "🚀" : "🔍"}</p>
          <p className="text-sm font-semibold">
            {campaigns.length === 0 ? "No campaigns yet" : "No campaigns match this filter"}
          </p>
          <p className="mt-2 text-xs editorial-muted max-w-md mx-auto">
            {campaigns.length === 0
              ? "Add your first campaign to track channels, budgets, ROI, and goals all in one board."
              : "Try a different stage filter."}
          </p>
          {campaigns.length === 0 && (
            <button
              onClick={() => {
                setEditId(null);
                setForm(DEFAULT_FORM);
                setShowForm(true);
              }}
              className="editorial-button editorial-button-primary mt-6 inline-flex"
            >
              + Add your first campaign
            </button>
          )}
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const stageClass = STAGE_COLOURS[c.stage] ?? "border-white/10 text-white/50";
            const isExpanded = expandedId === c.id;
            return (
              <article
                key={c.id}
                className="editorial-panel rounded-3xl p-5 transition hover:border-[rgba(212,183,143,0.25)] cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-snug flex-1">{c.name}</h3>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${stageClass}`}
                  >
                    {c.stage}
                  </span>
                </div>

                <p className="mt-2 text-xs editorial-muted">{c.channel}</p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {c.budget && (
                    <div className="rounded-xl bg-white/5 px-3 py-2">
                      <p className="text-xs editorial-muted">Budget</p>
                      <p className="text-xs font-semibold mt-0.5">{c.budget}</p>
                    </div>
                  )}
                  {c.roi && (
                    <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/15 px-3 py-2">
                      <p className="text-xs text-emerald-400/70">ROI</p>
                      <p className="text-xs font-semibold mt-0.5 text-emerald-300">{c.roi}</p>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div
                    className="mt-4 space-y-3 border-t border-white/5 pt-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.goal && (
                      <div>
                        <p className="text-xs editorial-muted uppercase tracking-widest mb-1">
                          Goal
                        </p>
                        <p className="text-xs text-white/80">{c.goal}</p>
                      </div>
                    )}
                    {c.notes && (
                      <div>
                        <p className="text-xs editorial-muted uppercase tracking-widest mb-1">
                          Notes
                        </p>
                        <p className="text-xs text-white/70 leading-relaxed whitespace-pre-line">
                          {c.notes}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => startEdit(c)}
                        className="text-xs editorial-muted hover:text-white transition"
                      >
                        Edit
                      </button>
                      <span className="editorial-muted opacity-30">·</span>
                      <button
                        onClick={() => remove(c.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                {!isExpanded && (c.goal || c.notes) && (
                  <p className="mt-3 text-xs editorial-muted opacity-50">Click to expand →</p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
