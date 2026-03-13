import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { isDatabaseUnavailableError, prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, authCookieOptions, createSessionToken } from "@/lib/session";
import { ensureStatsForUser } from "@/lib/stats";
import { enforceRateLimit } from "@/lib/rate-limit";
import { buildDemoUser } from "@/lib/demo-user";

export async function POST(req: Request) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "auth:login",
    limit: 10,
    windowMs: 10 * 60 * 1000,
    message: "Too many login attempts. Please try again in a few minutes.",
  });
  if (rateLimited) return rateLimited;

  let email: string | null = null;
  let password: string | null = null;
  const contentType = req.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (isJson) {
    ({ email, password } = await req.json());
  } else {
    const form = await req.formData();
    email = (form.get("email") as string) || null;
    password = (form.get("password") as string) || null;
  }

  if (!email || !password) {
    if (!isJson) {
      return NextResponse.redirect(new URL("/login?error=missing-fields", req.url));
    }
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let demoMode = false;
  let sessionUser: { id: string; email: string; name: string; username: string };

  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      if (!isJson) {
        return NextResponse.redirect(new URL("/login?error=invalid-credentials", req.url));
      }
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      if (!isJson) {
        return NextResponse.redirect(new URL("/login?error=invalid-credentials", req.url));
      }
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
    };

    // generate initial metrics if this is the first login
    await ensureStatsForUser(sessionUser);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error("Login failed", error);
      if (!isJson) {
        return NextResponse.redirect(new URL("/login?error=server", req.url));
      }
      return NextResponse.json({ error: "Unable to log in right now" }, { status: 500 });
    }

    demoMode = true;
    sessionUser = buildDemoUser({ email: normalizedEmail });
  }

  const response = isJson
    ? NextResponse.json({ success: true, mode: demoMode ? "demo" : "database" })
    : NextResponse.redirect(new URL(demoMode ? "/dashboard?mode=demo" : "/dashboard", req.url));

  response.cookies.set(AUTH_COOKIE_NAME, createSessionToken(sessionUser), authCookieOptions);
  return response;
}
