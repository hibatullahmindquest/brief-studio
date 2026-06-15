import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const AUTH_COOKIE_NAME = "postforge_session";
const SESSION_VERSION = "v2";
const LEGACY_SESSION_VERSION = "v1";

export const authCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  username: string;
};

type ParsedSession =
  | {
      user: SessionUser;
    }
  | {
      userId: string;
    };

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (secret && secret.length >= 32) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing SESSION_SECRET (must be at least 32 characters in production)");
  }

  return "dev-only-session-secret-change-me-before-production";
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function parseSessionFromToken(token: string): ParsedSession | null {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const providedSig = token.slice(separator + 1);
  const expectedSig = signPayload(payload);

  const providedBuffer = Buffer.from(providedSig);
  const expectedBuffer = Buffer.from(expectedSig);

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  const payloadSeparator = payload.indexOf(":");
  if (payloadSeparator <= 0) {
    return null;
  }

  const version = payload.slice(0, payloadSeparator);
  const value = payload.slice(payloadSeparator + 1);

  if (version === LEGACY_SESSION_VERSION) {
    return value ? { userId: value } : null;
  }

  if (version !== SESSION_VERSION) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<SessionUser>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.username !== "string"
    ) {
      return null;
    }

    return {
      user: {
        id: parsed.id,
        email: parsed.email,
        name: parsed.name,
        username: parsed.username,
      },
    };
  } catch {
    return null;
  }
}

export function createSessionToken(user: SessionUser | string) {
  const payload =
    typeof user === "string"
      ? `${LEGACY_SESSION_VERSION}:${user}`
      : `${SESSION_VERSION}:${Buffer.from(JSON.stringify(user)).toString("base64url")}`;
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = rawToken ? parseSessionFromToken(rawToken) : null;

  if (!session) {
    return null;
  }

  if ("user" in session) {
    return session.user;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
      },
    });

    return user;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export type SessionUserWithRole = SessionUser & {
  teamRole: string;
  isAdmin: boolean;
};

// Session token only carries identity, not role. Look up role from DB when gating.
export async function getCurrentUserWithRole(): Promise<SessionUserWithRole | null> {
  const sessionUser = await getCurrentUser();

  if (!sessionUser) {
    return null;
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { teamRole: true, isAdmin: true },
    });

    if (!dbUser) {
      return null;
    }

    return { ...sessionUser, teamRole: dbUser.teamRole, isAdmin: dbUser.isAdmin };
  } catch {
    return null;
  }
}

// For page handlers — redirects non-admins away.
export async function requireAdmin(): Promise<SessionUserWithRole> {
  const user = await getCurrentUserWithRole();

  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin) {
    redirect("/dashboard");
  }

  return user;
}

// For route handlers — throws a Response so the caller can `return` it on failure.
export async function assertAdmin(): Promise<SessionUserWithRole> {
  const user = await getCurrentUserWithRole();

  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  if (!user.isAdmin) {
    throw new Response("Forbidden — admin only", { status: 403 });
  }

  return user;
}
