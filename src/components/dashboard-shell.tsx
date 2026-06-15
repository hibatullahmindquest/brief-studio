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

  return (
    <div className="editorial-page text-foreground">
      <div className="editorial-container grid gap-6 lg:grid-cols-[270px_1fr]">
        {/* v6 SCIS sidebar — teal panel */}
        <aside className="rounded-4xl bg-[#00262a] p-5 text-[#aebfc4] lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto">
          {/* Brand mark */}
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#3b4ee2] text-lg font-bold text-white shadow-lg shadow-[#3b4ee2]/40">
              S
            </div>
            <div>
              <p className="text-base font-semibold leading-tight text-white">SCIS</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6f8389]">
                Creative Intelligence
              </p>
            </div>
          </div>

          {/* User card */}
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fd8549]/20 text-sm font-semibold text-[#fd8549]">
              {initialsFromName(user.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="truncate text-xs text-[#6f8389]">@{user.username}{isAdmin ? " · admin" : ""}</p>
            </div>
          </div>

          {/* Grouped nav */}
          <nav className="space-y-5">
            {dashboardNav.map((group) => {
              const items = group.items.filter((i) => !i.admin || isAdmin);
              if (items.length === 0) return null;
              return (
                <div key={group.group}>
                  <p className="mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#577077]">
                    {group.group}
                  </p>
                  <div className="space-y-1">
                    {items.map((item) => {
                      if (item.soon) {
                        return (
                          <div
                            key={item.label}
                            className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-[#5d7177] opacity-60"
                          >
                            <span>{item.label}</span>
                            <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide">
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
                          className={`block rounded-xl px-3 py-2 text-sm transition ${
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
            })}
          </nav>
        </aside>

        <section>{children}</section>
      </div>
    </div>
  );
}
