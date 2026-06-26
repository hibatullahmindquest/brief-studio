"use client";

import { useState } from "react";
import Link from "next/link";
import type { SessionUser } from "@/lib/session";
import { RecentDrawer } from "./RecentDrawer";

// Phase G — the Studio app shell. Owns the immersive chrome (top note bar, sticky header,
// collapsible left nav, Recent drawer) shared by the flow page and the deep-link result page.
// English chrome. The global <Header/> returns null on /studio, so this is the only top bar.

type IconProps = { className?: string };
const I = {
  menu: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={p.className}><path d="M4 6h16M4 12h16M4 18h16" /></svg>),
  clock: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={p.className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>),
  plus: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={p.className}><path d="M12 5v14M5 12h14" /></svg>),
  grid: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>),
  calendar: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>),
  mega: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" /><path d="M15 8a4 4 0 0 1 0 8" /></svg>),
  gear: (p: IconProps) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 7.5 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3 13.5H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 7.5a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 3h.09A1.65 1.65 0 0 0 12 1.51V3" /></svg>),
};

type NavItem = { key: string; label: string; href?: string; onClick?: () => void; icon: (p: IconProps) => React.ReactNode };

export function StudioShell({ user, children }: { user: SessionUser; isAdmin?: boolean; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false); // closed by default (locked decision)

  const initials = (user.name || user.username || "?").trim().slice(0, 1).toUpperCase();

  const nav: NavItem[] = [
    { key: "create", label: "Create", href: "/studio", icon: I.plus },
    { key: "library", label: "Library", onClick: () => setRecentOpen(true), icon: I.grid },
    { key: "calendar", label: "Calendar", href: "/dashboard", icon: I.calendar },
    { key: "campaigns", label: "Campaigns", href: "/dashboard", icon: I.mega },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* top note bar */}
      <div className="bg-[var(--sidebar)] px-4 py-1.5 text-center mono text-[10px] uppercase tracking-[0.16em] text-[#9fb4b8]">
        Internal creative workspace · SifuTutor / NakNgaji
      </div>

      <div className="flex min-h-0 flex-1">
        {/* sidebar nav */}
        <aside
          className={`hidden shrink-0 flex-col bg-[var(--sidebar)] text-[#cdd9dc] transition-[width] duration-200 min-[920px]:flex ${collapsed ? "w-[58px]" : "w-[224px]"}`}
        >
          <nav className="flex flex-1 flex-col gap-1 p-3">
            {nav.map((n) => {
              const inner = (
                <span className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/10 ${n.key === "create" ? "bg-white/10 text-white" : ""}`}>
                  <span className="h-[18px] w-[18px] shrink-0">{n.icon({ className: "h-[18px] w-[18px]" })}</span>
                  {!collapsed && <span className="truncate">{n.label}</span>}
                </span>
              );
              return n.href ? (
                <Link key={n.key} href={n.href} title={n.label}>{inner}</Link>
              ) : (
                <button key={n.key} type="button" onClick={n.onClick} title={n.label} className="text-left">{inner}</button>
              );
            })}

            <div className="my-2 h-px bg-white/10" />
            {!collapsed && <p className="px-3 pb-1 mono text-[9px] uppercase tracking-[0.16em] text-white/40">Settings</p>}
            <Link href="/dashboard/settings" title="Settings">
              <span className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/10">
                <span className="h-[18px] w-[18px] shrink-0">{I.gear({ className: "h-[18px] w-[18px]" })}</span>
                {!collapsed && <span className="truncate">Settings</span>}
              </span>
            </Link>
          </nav>
        </aside>

        {/* main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* sticky header */}
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--line)] bg-white/85 px-4 py-3 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              title="Toggle sidebar"
              className="hidden rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--card-2)] hover:text-[var(--foreground)] min-[920px]:block"
            >
              {I.menu({ className: "h-5 w-5" })}
            </button>
            <Link href="/studio" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white">S</span>
              <span className="flex flex-col leading-tight">
                <span className="text-[15px] font-bold text-[var(--foreground)]">Studio</span>
                <span className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">Creative Workspace</span>
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRecentOpen((o) => !o)}
                title="Recent"
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${recentOpen ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--line-2)] text-[var(--ink-soft)] hover:bg-[var(--card-2)]"}`}
              >
                {I.clock({ className: "h-4 w-4" })}
                <span className="hidden sm:inline">Recent</span>
              </button>
              <span title={user.name || user.username} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--brand-soft)] text-xs font-bold text-[var(--brand)]">
                {initials}
              </span>
            </div>
          </header>

          {/* work area + recent drawer */}
          <div className="flex min-h-0 flex-1">
            <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
            <RecentDrawer open={recentOpen} onClose={() => setRecentOpen(false)} />
          </div>
        </div>
      </div>
    </div>
  );
}
