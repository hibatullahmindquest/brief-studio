"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

type ApiUser = {
  id: string;
  email: string;
  name: string;
  username: string;
} | null;

export default function Header() {
  const [user, setUser] = useState<ApiUser>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data))
      .catch(() => setUser(null));
  }, []);

  // The app shell (dashboard/studio) has its own sidebar brand — no top bar there.
  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/studio")) {
    return null;
  }

  return (
    <>
    <div className="h-[60px]" aria-hidden />
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-white/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <a href={user ? "/dashboard" : "/"} className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#3b4ee2] text-base font-bold text-white shadow-lg shadow-[#3b4ee2]/30">
            S
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-bold text-[#00262a]">SCIS</span>
            <span className="mono text-[9px] uppercase tracking-[0.16em] text-[#7b8698]">
              Creative Intelligence
            </span>
          </span>
        </a>

        <nav className="flex items-center gap-5 text-sm font-medium">
          {user ? (
            <>
              <a href="/dashboard" className="text-[#33414f] hover:text-[#00262a]">
                Dashboard
              </a>
              <form method="post" action="/api/auth/logout">
                <button type="submit" className="text-sm text-[#fd8549] hover:underline">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <a
              href="/login"
              className="rounded-full bg-[#3b4ee2] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#304bd4]"
            >
              Login
            </a>
          )}
        </nav>
      </div>
    </header>
    </>
  );
}
