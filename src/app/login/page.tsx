import { getCurrentUser } from "@/lib/session";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    // already logged in
    return (
      <main className="max-w-md mx-auto py-24 px-6 text-center">
        <p className="text-lg">You&apos;re already logged in.</p>
        <a href="/dashboard" className="editorial-button editorial-button-primary mt-4 inline-block">
          Go to dashboard
        </a>
      </main>
    );
  }
  return (
    <main className="max-w-md mx-auto py-24 px-6">
      <h1 className="text-3xl font-bold mb-6">Login</h1>
      <form className="space-y-4" action="/api/auth/login" method="post">
        <label className="block">
          <span className="text-sm">Email</span>
          <input
            type="email"
            name="email"
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">Password</span>
          <input
            type="password"
            name="password"
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-2"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-full bg-foreground px-4 py-2 text-background font-semibold"
        >
          Log in
        </button>
      </form>
      <p className="mt-4 text-sm">
        Don&apos;t have an account? <a href="/signup" className="text-accent">Sign up</a>
      </p>
    </main>
  );
}
