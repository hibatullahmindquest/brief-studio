import { getCurrentUser } from "@/lib/session";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) {
    return (
      <main className="max-w-md mx-auto py-24 px-6 text-center">
        <p className="text-lg">You already have an account.</p>
        <a href="/dashboard" className="editorial-button editorial-button-primary mt-4 inline-block">
          Go to dashboard
        </a>
      </main>
    );
  }
  return (
    <main className="max-w-md mx-auto py-24 px-6">
      <h1 className="text-3xl font-bold mb-6">Sign up</h1>
      <form className="space-y-4" action="/api/auth/signup" method="post">
        <label className="block">
          <span className="text-sm">Full name</span>
          <input
            type="text"
            name="name"
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">Username</span>
          <input
            type="text"
            name="username"
            required
            className="mt-1 w-full rounded-lg border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-2"
          />
        </label>
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
          Sign up
        </button>
      </form>
      <p className="mt-4 text-sm">
        Already have an account? <a href="/login" className="text-accent">Log in</a>
      </p>
    </main>
  );
}
