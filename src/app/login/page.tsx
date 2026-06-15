import { getCurrentUser } from "@/lib/session";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-lg text-[#00262a]">You&apos;re already logged in.</p>
        <a href="/dashboard" className="editorial-button editorial-button-primary mt-4 inline-block">
          Go to dashboard
        </a>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <div className="v6-card p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--brand)] text-lg font-bold text-white shadow-lg shadow-[#3b4ee2]/30">
            S
          </span>
          <div>
            <p className="text-lg font-bold text-[#00262a]">SCIS</p>
            <p className="mono text-[10px] uppercase tracking-[0.14em] text-[#7b8698]">
              Creative Intelligence
            </p>
          </div>
        </div>

        <h1 className="editorial-title text-2xl">Sign in</h1>
        <form className="mt-5 space-y-4" action="/api/auth/login" method="post">
          <label className="block">
            <span className="eyebrow">Email</span>
            <input
              type="email"
              name="email"
              required
              className="mt-1.5 w-full rounded-xl border border-[var(--line-2)] bg-white px-4 py-2.5 text-[#00262a] outline-none focus:border-[var(--brand)]"
            />
          </label>
          <label className="block">
            <span className="eyebrow">Password</span>
            <input
              type="password"
              name="password"
              required
              className="mt-1.5 w-full rounded-xl border border-[var(--line-2)] bg-white px-4 py-2.5 text-[#00262a] outline-none focus:border-[var(--brand)]"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-[var(--brand)] px-4 py-2.5 font-semibold text-white transition hover:bg-[var(--brand-2)]"
          >
            Log in
          </button>
        </form>
        <p className="mt-4 text-sm text-[#7b8698]">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="font-semibold text-[var(--brand)]">
            Sign up
          </a>
        </p>
      </div>
    </main>
  );
}
