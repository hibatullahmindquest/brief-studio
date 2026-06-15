import Link from "next/link";

export default function Home() {
  const modules = [
    { k: "Organic", d: "Reach, saves, shares, engagement", c: "var(--brand)" },
    { k: "Paid", d: "Spend, CPL, CTR, fatigue", c: "var(--orange)" },
    { k: "Daily Signals", d: "Scale · Vary · Watch · Hold", c: "var(--brand)" },
    { k: "Reports", d: "Daily · weekly · monthly", c: "var(--orange)" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {/* Hero */}
      <section className="text-center">
        <span className="eyebrow">SifuTutor · NakNgaji · Internal</span>
        <h1 className="editorial-title mx-auto mt-4 max-w-3xl text-5xl leading-[1.05] sm:text-6xl">
          Creative Intelligence System
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#33414f]">
          One place for Meta organic + paid analytics, evidence-based daily decisions, reports,
          and AI creative generation — built for the SifuTutor &amp; NakNgaji team.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-2)]"
          >
            Login
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-[var(--line-2)] bg-white px-6 py-3 text-sm font-semibold text-[#33414f] transition hover:bg-[var(--card-2)]"
          >
            Open dashboard
          </Link>
        </div>
      </section>

      {/* Module grid */}
      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {modules.map((m) => (
          <div key={m.k} className="v6-card p-5">
            <span className="block h-2.5 w-2.5 rounded-full" style={{ background: m.c }} />
            <p className="mt-3 text-lg font-semibold text-[#00262a]">{m.k}</p>
            <p className="mt-1 text-sm text-[#7b8698]">{m.d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
