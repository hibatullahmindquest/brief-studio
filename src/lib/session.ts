import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const AUTH_COOKIE_NAME = "postforge_session";
const SESSION_VERSION = "v1";

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

function parseUserIdFromToken(token: string): string | null {
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

  const [version, userId] = payload.split(":");
  if (version !== SESSION_VERSION || !userId) {
    return null;
  }

  return userId;
}

export function createSessionToken(userId: string) {
  const payload = `${SESSION_VERSION}:${userId}`;
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const userId = rawToken ? parseUserIdFromToken(rawToken) : null;

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
    },
  });

  return user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
