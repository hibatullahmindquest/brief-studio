import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";

function asTrimmedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "campaigns:update",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;

  const user = await requireUser();
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const data: {
    name?: string;
    channel?: string;
    stage?: string;
    budget?: string;
    roi?: string;
    goal?: string;
    notes?: string;
  } = {};

  if ("name" in body) {
    const name = asTrimmedString(body.name, 140);
    if (!name) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
    }
    data.name = name;
  }

  if ("channel" in body) data.channel = asTrimmedString(body.channel, 80) || "Instagram";
  if ("stage" in body) data.stage = asTrimmedString(body.stage, 40) || "Planning";
  if ("budget" in body) data.budget = asTrimmedString(body.budget, 80);
  if ("roi" in body) data.roi = asTrimmedString(body.roi, 80);
  if ("goal" in body) data.goal = asTrimmedString(body.goal, 220);
  if ("notes" in body) data.notes = asTrimmedString(body.notes, 4000);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.campaign.updateMany({
    where: { id, userId: user.id },
    data,
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  return NextResponse.json({ campaign });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "campaigns:delete",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;

  const user = await requireUser();
  const deleted = await prisma.campaign.deleteMany({
    where: { id, userId: user.id },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
