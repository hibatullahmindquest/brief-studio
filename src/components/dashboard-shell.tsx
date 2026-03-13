"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNavItems } from "@/lib/dashboard-data";
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
}: {
  children: React.ReactNode;
  user: SessionUser;
}) {
  const pathname = usePathname();
  const userName = user.name;

  return (
    <div className="editorial-page text-foreground">
      <div className="editorial-container grid gap-6 lg:grid-cols-[270px_1fr]">
        <aside className="editorial-panel rounded-4xl p-5 sm:p-6 lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <div className="mb-7 flex items-center gap-3 rounded-3xl border border-white/10 p-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(212,183,143,0.16)] text-sm font-semibold">
              {initialsFromName(userName)}
            </div>
            <div>
              <p className="text-sm font-semibold">{userName}</p>
              <p className="text-xs editorial-muted">@{user.username}</p>
            </div>
          </div>

          <nav className="space-y-2">
            {dashboardNavItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-2xl border px-4 py-3 transition ${
                    active
                      ? "border-(--accent) bg-[rgba(212,183,143,0.12)]"
                      : "border-white/10 bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)]"
                  }`}
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs editorial-muted">{item.description}</p>
                </Link>
              );
            })}
          </nav>

          <div className="mt-7 rounded-3xl border border-white/10 p-4">
            <p className="editorial-kicker">This week</p>
            <p className="mt-3 text-2xl font-semibold">£4,200</p>
            <p className="mt-1 text-xs editorial-muted">Projected recurring revenue uplift</p>
          </div>
        </aside>

        <section>{children}</section>
      </div>
    </div>
  );
}
