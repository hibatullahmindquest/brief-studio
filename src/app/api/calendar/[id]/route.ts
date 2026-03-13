import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";

const DAYS = new Set(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);

function asTrimmedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function asMonth(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 11 ? parsed : null;
}

function asYear(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : null;
}

function asTime(value: unknown) {
  const time = asTrimmedString(value, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "calendar:update",
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
    day?: string;
    month?: number;
    year?: number;
    title?: string;
    time?: string;
    type?: string;
    note?: string;
  } = {};

  if ("title" in body) {
    const title = asTrimmedString(body.title, 140);
    if (!title) {
      return NextResponse.json({ error: "Event title is required" }, { status: 400 });
    }
    data.title = title;
  }

  if ("day" in body) {
    const day = asTrimmedString(body.day, 3);
    if (!DAYS.has(day)) {
      return NextResponse.json({ error: "Invalid day value" }, { status: 400 });
    }
    data.day = day;
  }

  if ("month" in body) {
    const month = asMonth(body.month);
    if (month === null) {
      return NextResponse.json({ error: "Invalid month value" }, { status: 400 });
    }
    data.month = month;
  }

  if ("year" in body) {
    const year = asYear(body.year);
    if (year === null) {
      return NextResponse.json({ error: "Invalid year value" }, { status: 400 });
    }
    data.year = year;
  }

  if ("time" in body) {
    const time = asTime(body.time);
    if (!time) {
      return NextResponse.json({ error: "Invalid time value" }, { status: 400 });
    }
    data.time = time;
  }

  if ("type" in body) data.type = asTrimmedString(body.type, 24) || "Post";
  if ("note" in body) data.note = asTrimmedString(body.note, 2000);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.calendarEvent.updateMany({
    where: { id, userId: user.id },
    data,
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const event = await prisma.calendarEvent.findUnique({ where: { id } });
  return NextResponse.json({ event });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "calendar:delete",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;

  const user = await requireUser();
  const deleted = await prisma.calendarEvent.deleteMany({
    where: { id, userId: user.id },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
