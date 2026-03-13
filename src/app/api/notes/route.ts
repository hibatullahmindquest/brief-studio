import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";

function asTrimmedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function asBoolean(value: unknown) {
  return value === true;
}

export async function GET(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "notes:list",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const user = await requireUser();
  const notes = await prisma.note.findMany({
    where: { userId: user.id },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "notes:create",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const user = await requireUser();
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const title = asTrimmedString(body.title, 120);
  const noteBody = asTrimmedString(body.body, 12000);
  const colour = asTrimmedString(body.colour, 24) || "zinc";
  const tag = asTrimmedString(body.tag, 40);
  const pinned = asBoolean(body.pinned);

  if (!title && !noteBody) {
    return NextResponse.json({ error: "Title or body is required" }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: {
      userId: user.id,
      title,
      body: noteBody,
      colour,
      tag,
      pinned,
    },
  });

  return NextResponse.json({ note }, { status: 201 });
}
