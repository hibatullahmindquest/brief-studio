import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";

function asTrimmedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function GET(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "campaigns:list",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const user = await requireUser();
  const campaigns = await prisma.campaign.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "campaigns:create",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const user = await requireUser();
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = asTrimmedString(body.name, 140);
  if (!name) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId: user.id,
      name,
      channel: asTrimmedString(body.channel, 80) || "Instagram",
      stage: asTrimmedString(body.stage, 40) || "Planning",
      budget: asTrimmedString(body.budget, 80),
      roi: asTrimmedString(body.roi, 80),
      goal: asTrimmedString(body.goal, 220),
      notes: asTrimmedString(body.notes, 4000),
    },
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
