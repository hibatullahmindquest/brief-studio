import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, authCookieOptions, createSessionToken } from "@/lib/session";
import { ensureStatsForUser } from "@/lib/stats";
import { enforceRateLimit } from "@/lib/rate-limit";

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

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
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

  const response = isJson
    ? NextResponse.json({ success: true })
    : NextResponse.redirect(new URL("/dashboard", req.url));

  // generate initial metrics if this is the first login
  await ensureStatsForUser({
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
  });

  response.cookies.set(AUTH_COOKIE_NAME, createSessionToken(user.id), authCookieOptions);
  return response;
}
