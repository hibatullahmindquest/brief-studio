import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { ensureStatsForUser } from "@/lib/stats";

const ALLOWED_TONES = new Set(["Bold", "Luxury", "Hype"]);
const DEFAULT_CORE_OFFER = "AI-powered social media copy system";

function asTrimmedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function GET(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "settings:get",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const user = await requireUser();
  await ensureStatsForUser(user);

  const [stats, preference] = await Promise.all([
    prisma.stats.findUnique({ where: { userId: user.id } }),
    prisma.userPreference.findUnique({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({
    brandName: stats?.brandName ?? user.name,
    defaultTone: preference?.defaultTone ?? "Bold",
    coreOffer: preference?.coreOffer ?? DEFAULT_CORE_OFFER,
  });
}

export async function POST(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "settings:update",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const user = await requireUser();
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const brandName = asTrimmedString(body.brandName, 120);
  const defaultTone = asTrimmedString(body.defaultTone, 24) || "Bold";
  const coreOffer = asTrimmedString(body.coreOffer, 240) || DEFAULT_CORE_OFFER;

  if (!brandName) {
    return NextResponse.json({ error: "Brand name is required" }, { status: 400 });
  }

  if (!ALLOWED_TONES.has(defaultTone)) {
    return NextResponse.json({ error: "Invalid default tone" }, { status: 400 });
  }

  await ensureStatsForUser(user);

  await prisma.$transaction([
    prisma.userPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        brandName,
        defaultTone,
        coreOffer,
      },
      update: {
        brandName,
        defaultTone,
        coreOffer,
      },
    }),
    prisma.stats.update({
      where: { userId: user.id },
      data: {
        brandName,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    brandName,
    defaultTone,
    coreOffer,
  });
}
