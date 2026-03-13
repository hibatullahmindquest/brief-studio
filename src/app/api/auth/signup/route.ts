import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { isDatabaseUnavailableError, prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, authCookieOptions, createSessionToken } from "@/lib/session";
import { ensureStatsForUser } from "@/lib/stats";
import { enforceRateLimit } from "@/lib/rate-limit";
import { buildDemoUser } from "@/lib/demo-user";

export async function POST(req: Request) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "auth:signup",
    limit: 5,
    windowMs: 10 * 60 * 1000,
    message: "Too many signup attempts. Please try again in a few minutes.",
  });
  if (rateLimited) return rateLimited;

  // accept JSON or form data
  let email: string | null = null;
  let password: string | null = null;
  let name: string | null = null;
  let username: string | null = null;
  const contentType = req.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (isJson) {
    ({ email, password, name, username } = await req.json());
  } else {
    const form = await req.formData();
    email = (form.get("email") as string) || null;
    password = (form.get("password") as string) || null;
    name = (form.get("name") as string) || null;
    username = (form.get("username") as string) || null;
  }
  const normalizedEmail = email?.trim().toLowerCase() ?? "";
  const normalizedName = name?.trim() ?? "";
  const normalizedUsername = username?.trim().toLowerCase() ?? "";

  if (!normalizedEmail || !password) {
    if (!isJson) {
      return NextResponse.redirect(new URL("/signup?error=missing-fields", req.url));
    }
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!normalizedName || !normalizedUsername) {
    if (!isJson) {
      return NextResponse.redirect(new URL("/signup?error=missing-fields", req.url));
    }
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (password.length < 8) {
    if (!isJson) {
      return NextResponse.redirect(new URL("/signup?error=password-too-short", req.url));
    }
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  let demoMode = false;
  let sessionUser: { id: string; email: string; name: string; username: string };

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { username: normalizedUsername }],
      },
    });
    if (existing) {
      if (!isJson) {
        return NextResponse.redirect(new URL("/signup?error=user-exists", req.url));
      }
      return NextResponse.json({ error: "User exists" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashed,
        name: normalizedName,
        username: normalizedUsername,
      },
    });

    sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
    };

    // create an initial stats snapshot for the brand on signup as well
    await ensureStatsForUser(sessionUser);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error("Signup failed", error);
      if (!isJson) {
        return NextResponse.redirect(new URL("/signup?error=server", req.url));
      }
      return NextResponse.json({ error: "Unable to sign up right now" }, { status: 500 });
    }

    demoMode = true;
    sessionUser = buildDemoUser({
      email: normalizedEmail,
      name: normalizedName,
      username: normalizedUsername,
    });
  }

  const response = isJson
    ? NextResponse.json({ success: true, mode: demoMode ? "demo" : "database" })
    : NextResponse.redirect(new URL(demoMode ? "/dashboard?mode=demo" : "/dashboard", req.url));

  response.cookies.set(AUTH_COOKIE_NAME, createSessionToken(sessionUser), authCookieOptions);
  return response;
}
