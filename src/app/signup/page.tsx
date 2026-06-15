import { getCurrentUser } from "@/lib/session";

const inputCls =
  "mt-1.5 w-full rounded-xl border border-[var(--line-2)] bg-white px-4 py-2.5 text-[#00262a] outline-none focus:border-[var(--brand)]";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-lg text-[#00262a]">You already have an account.</p>
        <a href="/dashboard" className="editorial-button editorial-button-primary mt-4 inline-block">
          Go to dashboard
        </a>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="v6-card p-8">
        <h1 className="editorial-title text-2xl">Create account</h1>
        <form className="mt-5 space-y-4" action="/api/auth/signup" method="post">
          <label className="block">
            <span className="eyebrow">Full name</span>
            <input type="text" name="name" required className={inputCls} />
          </label>
          <label className="block">
            <span className="eyebrow">Username</span>
            <input type="text" name="username" required className={inputCls} />
          </label>
          <label className="block">
            <span className="eyebrow">Email</span>
            <input type="email" name="email" required className={inputCls} />
          </label>
          <label className="block">
            <span className="eyebrow">Password</span>
            <input type="password" name="password" required className={inputCls} />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-[var(--brand)] px-4 py-2.5 font-semibold text-white transition hover:bg-[var(--brand-2)]"
          >
            Sign up
          </button>
        </form>
        <p className="mt-4 text-sm text-[#7b8698]">
          Already have an account?{" "}
          <a href="/login" className="font-semibold text-[var(--brand)]">
            Log in
          </a>
        </p>
      </div>
    </main>
  );
}
