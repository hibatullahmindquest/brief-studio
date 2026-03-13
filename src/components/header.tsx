"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type ApiUser = {
  id: string;
  email: string;
  name: string;
  username: string;
} | null;

export default function Header() {
  const [user, setUser] = useState<ApiUser>(null);

  useEffect(() => {
    // fetch current user info
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data))
      .catch(() => setUser(null));
  }, []);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 overflow-hidden rounded-full border border-white/20">
            <Image
              src="/images/preview.png"
              alt="PostForge AI preview"
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          </div>
          <span className="text-lg font-bold">PostForge AI</span>
        </div>
        <nav className="flex gap-6 text-sm font-medium items-center">
          <a href="/approach">Approach</a>
          <a href="/offerings">Offerings</a>
          <a href="/community">Community</a>
          <a href="/pricing">Pricing</a>
          {user ? (
            <>
              <a
                href="/dashboard/settings"
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs hover:border-white/35"
              >
                Profile
              </a>
              <span className="text-sm">{user.name}</span>
              <form method="post" action="/api/auth/logout">
                <button
                  type="submit"
                  className="ml-4 text-sm text-accent hover:underline"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <a href="/login">Login</a>
              <a href="/signup" className="ml-2">Sign up</a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
