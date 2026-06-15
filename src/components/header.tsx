"use client";

import { useState, useEffect } from "react";

type ApiUser = {
  id: string;
  email: string;
  name: string;
  username: string;
} | null;

export default function Header() {
  const [user, setUser] = useState<ApiUser>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data))
      .catch(() => setUser(null));
  }, []);

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <a href={user ? "/dashboard" : "/"} className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#3b4ee2] text-base font-bold text-white shadow-lg shadow-[#3b4ee2]/40">
            S
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-bold">SCIS</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">
              Creative Intelligence
            </span>
          </span>
        </a>

        <nav className="flex items-center gap-5 text-sm font-medium">
          {user ? (
            <>
              <a href="/dashboard" className="text-white/70 hover:text-white">
                Dashboard
              </a>
              <a
                href="/dashboard/settings"
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs hover:border-white/35"
              >
                {user.name}
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
  );
}
