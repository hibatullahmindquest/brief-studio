"use client";

import { useState, useEffect, useRef } from "react";

const NOTE_COLOURS = [
  { name: "zinc",    bg: "bg-[rgba(255,255,255,0.03)]",   border: "border-white/10",          label: "bg-white/10 text-white/50" },
  { name: "gold",    bg: "bg-[rgba(212,183,143,0.07)]",   border: "border-[rgba(212,183,143,0.2)]", label: "bg-[rgba(212,183,143,0.15)] text-[rgba(212,183,143,0.8)]" },
  { name: "violet",  bg: "bg-violet-500/5",               border: "border-violet-500/20",      label: "bg-violet-500/15 text-violet-300" },
  { name: "emerald", bg: "bg-emerald-500/5",              border: "border-emerald-500/20",     label: "bg-emerald-500/15 text-emerald-300" },
  { name: "blue",    bg: "bg-blue-500/5",                 border: "border-blue-500/20",        label: "bg-blue-500/15 text-blue-300" },
  { name: "pink",    bg: "bg-pink-500/5",                 border: "border-pink-500/20",        label: "bg-pink-500/15 text-pink-300" },
  { name: "orange",  bg: "bg-orange-500/5",               border: "border-orange-500/20",      label: "bg-orange-500/15 text-orange-300" },
];

const TAGS = ["Idea", "Task", "Caption", "Strategy", "Reminder", "Inspiration", "Draft"];

type Note = {
  id: string;
  title: string;
  body: string;
  colour: string;
  tag: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_FORM = { title: "", body: "", colour: "zinc", tag: "", pinned: false };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void loadNotes();
  }, []);

  useEffect(() => {
    if (showForm && bodyRef.current) bodyRef.current.focus();
  }, [showForm]);

  async function loadNotes() {
    setLoading(true);
    setApiError("");
    try {
      const res = await fetch("/api/notes", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { notes: Note[] };
      setNotes(Array.isArray(data.notes) ? data.notes : []);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() && !form.body.trim()) return;

    setApiError("");

    try {
      if (editId) {
        const res = await fetch(`/api/notes/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { note: Note };
        setNotes((prev) => prev.map((n) => (n.id === editId ? data.note : n)));
        setEditId(null);
      } else {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { note: Note };
        setNotes((prev) => [data.note, ...prev]);
      }

      setForm(DEFAULT_FORM);
      setShowForm(false);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to save note");
    }
  }

  function startEdit(n: Note) {
    setForm({ title: n.title, body: n.body, colour: n.colour, tag: n.tag, pinned: n.pinned });
    setEditId(n.id);
    setShowForm(true);
    setExpandedId(null);
  }

  async function remove(id: string) {
    setApiError("");
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to delete note");
    }
  }

  async function togglePin(id: string) {
    const target = notes.find((n) => n.id === id);
    if (!target) return;

    setApiError("");
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !target.pinned }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { note: Note };
      setNotes((prev) => prev.map((n) => (n.id === id ? data.note : n)));
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to update note");
    }
  }

  const query = search.toLowerCase();
  let filtered = notes.filter((n) => {
    const matchSearch = !query || n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query) || n.tag.toLowerCase().includes(query);
    const matchTag = filterTag === "All" || n.tag === filterTag;
    return matchSearch && matchTag;
  });

  // Pinned first
  filtered = [...filtered.filter((n) => n.pinned), ...filtered.filter((n) => !n.pinned)];

  const usedTags = [...new Set(notes.map((n) => n.tag).filter(Boolean))];

  const colourMeta = (name: string) => NOTE_COLOURS.find((c) => c.name === name) ?? NOTE_COLOURS[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="editorial-kicker">Notes</p>
            <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">Your idea space</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
              Capture captions, ideas, strategy drafts, reminders — anything, instantly.
            </p>
          </div>
          <button
            onClick={() => { setEditId(null); setForm(DEFAULT_FORM); setShowForm(true); }}
            className="editorial-button editorial-button-primary shrink-0 self-start"
          >
            + New note
          </button>
        </div>
      </section>

      {apiError && (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {apiError}
        </section>
      )}

      {/* Compose form */}
      {showForm && (
        <section className="editorial-panel rounded-4xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Note title…"
                className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-3 text-lg font-semibold outline-none focus:border-[rgba(212,183,143,0.5)] transition placeholder:text-white/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <textarea
                ref={bodyRef}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Start writing… ideas, captions, bullet points, anything."
                rows={8}
                className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm leading-relaxed outline-none focus:border-[rgba(212,183,143,0.5)] transition resize-y placeholder:text-white/20"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {/* Colour picker */}
              <div className="flex items-center gap-2">
                <span className="text-xs editorial-muted uppercase tracking-widest">Color</span>
                <div className="flex gap-1.5">
                  {NOTE_COLOURS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, colour: c.name }))}
                      className={`h-5 w-5 rounded-full border transition ${c.border} ${c.bg} ${form.colour === c.name ? "ring-2 ring-[rgba(212,183,143,0.6)] ring-offset-1 ring-offset-black/50" : "hover:scale-110"}`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
              {/* Tag */}
              <div className="flex items-center gap-2">
                <span className="text-xs editorial-muted uppercase tracking-widest">Tag</span>
                <select
                  value={form.tag}
                  onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-[rgba(24,24,24,0.95)] px-3 py-1.5 text-xs outline-none focus:border-[rgba(212,183,143,0.5)] transition appearance-none"
                >
                  <option value="">None</option>
                  {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {/* Pin */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-xs editorial-muted">Pin to top</span>
              </label>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="editorial-button editorial-button-primary">{editId ? "Save changes" : "Save note"}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="editorial-button editorial-button-secondary">Discard</button>
            </div>
          </form>
        </section>
      )}

      {/* Search + tag filter */}
      {notes.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.03)] pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[rgba(212,183,143,0.4)] transition"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {["All", ...usedTags].map((t) => (
              <button
                key={t}
                onClick={() => setFilterTag(t)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${filterTag === t ? "border-[rgba(212,183,143,0.5)] bg-[rgba(212,183,143,0.1)] text-[rgba(212,183,143,0.9)]" : "border-white/10 editorial-muted hover:border-white/25"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes grid */}
      {loading ? (
        <section className="editorial-panel rounded-4xl p-10 text-center">
          <p className="text-sm editorial-muted">Loading notes...</p>
        </section>
      ) : filtered.length === 0 ? (
        <section className="editorial-panel rounded-4xl p-14 text-center">
          <p className="text-5xl mb-4">{notes.length === 0 ? "📝" : "🔍"}</p>
          <p className="text-base font-semibold">{notes.length === 0 ? "Nothing here yet" : "No notes match your search"}</p>
          <p className="mt-2 text-sm editorial-muted max-w-sm mx-auto">
            {notes.length === 0
              ? `Hit "New note" to capture your first idea, caption draft, or strategy thought.`
              : "Try clearing the search or changing the tag filter."}
          </p>
          {notes.length === 0 && (
            <button
              onClick={() => { setEditId(null); setForm(DEFAULT_FORM); setShowForm(true); }}
              className="editorial-button editorial-button-primary mt-6 inline-flex"
            >
              + Write your first note
            </button>
          )}
        </section>
      ) : (
        <section className="columns-1 sm:columns-2 xl:columns-3 gap-4 space-y-4">
          {filtered.map((note) => {
            const cm = colourMeta(note.colour);
            const isExpanded = expandedId === note.id;
            const isLong = note.body.length > 200;
            return (
              <article
                key={note.id}
                className={`break-inside-avoid rounded-3xl border p-5 transition hover:scale-[1.01] ${cm.bg} ${cm.border}`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                    {note.pinned && <span className="text-xs">📌</span>}
                    {note.tag && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cm.label}`}>{note.tag}</span>
                    )}
                  </div>
                  <button
                    onClick={() => togglePin(note.id)}
                    className={`shrink-0 text-xs transition ${note.pinned ? "text-[rgba(212,183,143,0.8)]" : "editorial-muted hover:text-white"}`}
                    title={note.pinned ? "Unpin" : "Pin"}
                  >
                    {note.pinned ? "📌" : "☆"}
                  </button>
                </div>

                {/* Title */}
                {note.title && (
                  <h3 className="mt-2.5 text-sm font-semibold leading-snug">{note.title}</h3>
                )}

                {/* Body */}
                {note.body && (
                  <p
                    className={`mt-2 text-xs leading-relaxed editorial-muted whitespace-pre-line ${!isExpanded && isLong ? "line-clamp-6" : ""}`}
                  >
                    {note.body}
                  </p>
                )}
                {isLong && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : note.id)}
                    className="mt-1.5 text-xs editorial-muted hover:text-white transition"
                  >
                    {isExpanded ? "▲ Show less" : "▼ Show more"}
                  </button>
                )}

                {/* Footer */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs editorial-muted opacity-50">{timeAgo(note.updatedAt)}</span>
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(note)} className="text-xs editorial-muted hover:text-white transition">Edit</button>
                    <button onClick={() => remove(note.id)} className="text-xs text-red-400/70 hover:text-red-300 transition">Delete</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
