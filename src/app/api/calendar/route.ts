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

export async function GET(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "calendar:list",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const user = await requireUser();
  const events = await prisma.calendarEvent.findMany({
    where: { userId: user.id },
    orderBy: [{ year: "asc" }, { month: "asc" }, { day: "asc" }, { time: "asc" }],
  });

  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "calendar:create",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const user = await requireUser();
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const title = asTrimmedString(body.title, 140);
  const day = asTrimmedString(body.day, 3);
  const month = asMonth(body.month);
  const year = asYear(body.year);
  const time = asTime(body.time);

  if (!title) {
    return NextResponse.json({ error: "Event title is required" }, { status: 400 });
  }

  if (!DAYS.has(day)) {
    return NextResponse.json({ error: "Invalid day value" }, { status: 400 });
  }

  if (month === null || year === null || !time) {
    return NextResponse.json({ error: "Invalid date/time values" }, { status: 400 });
  }

  const event = await prisma.calendarEvent.create({
    data: {
      userId: user.id,
      day,
      month,
      year,
      title,
      time,
      type: asTrimmedString(body.type, 24) || "Post",
      note: asTrimmedString(body.note, 2000),
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}
