"use client";

import { useState, useEffect } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const TYPE_COLOURS: Record<string, { card: string; badge: string; dot: string }> = {
  Reel:     { card: "border-violet-500/30 bg-violet-500/5",  badge: "bg-violet-500/20 text-violet-300 border-violet-500/30", dot: "bg-violet-400" },
  Carousel: { card: "border-blue-500/30 bg-blue-500/5",      badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",       dot: "bg-blue-400"   },
  Post:     { card: "border-emerald-500/30 bg-emerald-500/5",badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",dot: "bg-emerald-400"},
  Story:    { card: "border-pink-500/30 bg-pink-500/5",      badge: "bg-pink-500/20 text-pink-300 border-pink-500/30",       dot: "bg-pink-400"   },
  TikTok:   { card: "border-red-500/30 bg-red-500/5",        badge: "bg-red-500/20 text-red-300 border-red-500/30",          dot: "bg-red-400"    },
  Tweet:    { card: "border-sky-500/30 bg-sky-500/5",        badge: "bg-sky-500/20 text-sky-300 border-sky-500/30",          dot: "bg-sky-400"    },
};

type CalEvent = { id: string; day: string; month: number; year: number; title: string; time: string; type: string; note?: string };

function defaultFormState() {
  const now = new Date();
  return {
    day: DAYS[1],
    month: now.getMonth(),
    year: now.getFullYear(),
    title: "",
    time: "10:00",
    type: "Post",
    note: "",
  };
}

function todayIndex() {
  const d = new Date().getDay(); // 0=Sun
  return d;
}

export default function DashboardCalendarPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultFormState());
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 9 }, (_, i) => currentYear - 1 + i);

  useEffect(() => {
    void loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    setApiError("");
    try {
      const res = await fetch("/api/calendar", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { events: CalEvent[] };
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;

    setApiError("");
    try {
      if (editId) {
        const res = await fetch(`/api/calendar/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { event: CalEvent };
        setEvents((prev) => prev.map((ev) => (ev.id === editId ? data.event : ev)));
        setEditId(null);
      } else {
        const res = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { event: CalEvent };
        setEvents((prev) => [...prev, data.event]);
      }

      setForm(defaultFormState());
      setShowForm(false);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to save event");
    }
  }

  function startEdit(ev: CalEvent) {
    setForm({
      day: ev.day,
      month: ev.month,
      year: ev.year,
      title: ev.title,
      time: ev.time,
      type: ev.type,
      note: ev.note ?? "",
    });
    setEditId(ev.id);
    setShowForm(true);
  }

  async function remove(id: string) {
    setApiError("");
    try {
      const res = await fetch(`/api/calendar/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to delete event");
    }
  }

  const todayName = DAYS[todayIndex()];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="editorial-kicker">Calendar</p>
            <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">Your publishing schedule</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
              Add your own posts, reels, and stories — stay consistent and never miss a beat.
            </p>
          </div>
          <button
            onClick={() => { setEditId(null); setForm(defaultFormState()); setShowForm(true); }}
            className="editorial-button editorial-button-primary shrink-0 self-start"
          >
            + Add event
          </button>
        </div>
      </section>

      {apiError && (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {apiError}
        </section>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <section className="editorial-panel rounded-4xl p-6">
          <h2 className="editorial-title text-2xl mb-5">{editId ? "Edit event" : "New event"}</h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.15em] editorial-muted">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Product launch reel"
                className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] transition"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.15em] editorial-muted">Day</label>
              <select
                value={form.day}
                onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}
                className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] transition appearance-none"
              >
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.15em] editorial-muted">Time</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] transition"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.15em] editorial-muted">Month</label>
              <select
                value={form.month}
                onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))}
                className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] transition appearance-none"
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.15em] editorial-muted">Year</label>
              <select
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] transition appearance-none"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.15em] editorial-muted">Content type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] transition appearance-none"
              >
                {Object.keys(TYPE_COLOURS).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs uppercase tracking-[0.15em] editorial-muted">Note (optional)</label>
              <input
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Caption idea, hashtags, reminder…"
                className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.5)] transition"
              />
            </div>
            <div className="flex gap-3 sm:col-span-2 xl:col-span-3">
              <button type="submit" className="editorial-button editorial-button-primary">
                {editId ? "Save changes" : "Add to calendar"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="editorial-button editorial-button-secondary">
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Week strip */}
      <section className="editorial-panel rounded-4xl p-6">
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {DAYS.map((day) => {
            const count = events.filter((e) => e.day === day).length;
            const isToday = day === todayName;
            return (
              <div
                key={day}
                className={`rounded-2xl border px-1.5 py-3 transition ${isToday ? "border-[rgba(212,183,143,0.5)] bg-[rgba(212,183,143,0.08)]" : "border-white/10"}`}
              >
                <p className={`text-xs font-semibold uppercase tracking-[0.15em] ${isToday ? "text-[rgba(212,183,143,0.9)]" : "editorial-muted"}`}>{day}</p>
                {count > 0 && (
                  <div className="mt-2 flex justify-center gap-0.5 flex-wrap">
                    {events.filter((e) => e.day === day).map((ev) => (
                      <span key={ev.id} className={`h-1.5 w-1.5 rounded-full ${TYPE_COLOURS[ev.type]?.dot ?? "bg-white/40"}`} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Event cards */}
        {loading ? (
          <div className="mt-8 rounded-3xl border border-white/10 p-12 text-center">
            <p className="text-sm editorial-muted">Loading calendar...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-white/15 p-12 text-center">
            <p className="text-4xl mb-4">📅</p>
            <p className="text-sm font-semibold">No events yet</p>
            <p className="mt-2 text-xs editorial-muted">Hit &quot;+ Add event&quot; to schedule your first post.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {DAYS.flatMap((day) =>
              events
                .filter((ev) => ev.day === day)
                .sort((a, b) => {
                  if (a.year !== b.year) return a.year - b.year;
                  if (a.month !== b.month) return a.month - b.month;
                  return a.time.localeCompare(b.time);
                })
                .map((ev) => {
                  const colours = TYPE_COLOURS[ev.type] ?? { card: "border-white/10 bg-white/2", badge: "bg-white/10 text-white/60", dot: "bg-white/40" };
                  return (
                    <article key={ev.id} className={`group rounded-3xl border p-4 transition hover:scale-[1.01] ${colours.card}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold editorial-muted">{ev.day}</p>
                          <span className="text-xs editorial-muted opacity-60">{ev.time}</span>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${colours.badge}`}>{ev.type}</span>
                      </div>
                      <p className="mt-1 text-xs editorial-muted opacity-70">{MONTHS[ev.month]} {ev.year}</p>
                      <p className="mt-2 text-sm font-semibold leading-snug">{ev.title}</p>
                      {ev.note && <p className="mt-1.5 text-xs editorial-muted italic line-clamp-2">{ev.note}</p>}
                      <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(ev)} className="text-xs editorial-muted hover:text-white transition">Edit</button>
                        <span className="editorial-muted opacity-30">·</span>
                        <button onClick={() => remove(ev.id)} className="text-xs text-red-400 hover:text-red-300 transition">Delete</button>
                      </div>
                    </article>
                  );
                })
            )}
          </div>
        )}
      </section>
    </div>
  );
}
