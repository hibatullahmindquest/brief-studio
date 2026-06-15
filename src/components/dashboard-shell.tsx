"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNav } from "@/lib/dashboard-data";
import type { SessionUser } from "@/lib/session";

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function DashboardShell({
  children,
  user,
  isAdmin = false,
}: {
  children: React.ReactNode;
  user: SessionUser;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  const renderGroup = (group: (typeof dashboardNav)[number]) => {
    const items = group.items.filter((i) => !i.admin || isAdmin);
    if (items.length === 0) return null;
    return (
      <div key={group.group}>
        <p className="mb-1.5 px-2 mono text-[9px] uppercase tracking-[0.18em] text-[#577077]">
          {group.group}
        </p>
        <div className="space-y-0.5">
          {items.map((item) => {
            if (item.soon) {
              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] text-[#5d7177] opacity-55"
                >
                  <span>{item.label}</span>
                  <span className="rounded bg-white/5 px-1 py-0.5 mono text-[8px] uppercase tracking-wide">
                    soon
                  </span>
                </div>
              );
            }
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-2.5 py-1.5 text-[13px] transition ${
                  active
                    ? "bg-[#3b4ee2] font-semibold text-white"
                    : "text-[#aebfc4] hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  const topGroups = dashboardNav.filter((g) => g.group !== "Admin");
  const adminGroup = dashboardNav.find((g) => g.group === "Admin");

  return (
    <div className="editorial-page text-foreground">
      <div className="editorial-container grid gap-5 lg:grid-cols-[232px_1fr]">
        {/* v6 SCIS sidebar — minimal, flex column */}
        <aside className="flex flex-col rounded-3xl bg-[#00262a] p-4 text-[#aebfc4] lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          {/* Brand mark */}
          <Link href="/dashboard" className="mb-5 flex items-center gap-2.5 px-1">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#3b4ee2] text-base font-bold text-white shadow-md shadow-[#3b4ee2]/40">
              S
            </span>
            <span>
              <span className="block text-sm font-semibold leading-tight text-white">SCIS</span>
              <span className="block mono text-[8px] uppercase tracking-[0.14em] text-[#6f8389]">
                Creative Intelligence
              </span>
            </span>
          </Link>

          {/* Top nav (grows) */}
          <nav className="flex-1 space-y-4 overflow-y-auto">{topGroups.map(renderGroup)}</nav>

          {/* Bottom: admin + user (pinned) */}
          <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
            {adminGroup && renderGroup(adminGroup)}
            <div className="flex items-center gap-2.5 px-1">
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[#fd8549]/20 text-xs font-semibold text-[#fd8549]">
                {initialsFromName(user.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-white">{user.name}</span>
                <span className="block truncate text-[10px] text-[#6f8389]">
                  @{user.username}
                  {isAdmin ? " · admin" : ""}
                </span>
              </span>
            </div>
          </div>
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
