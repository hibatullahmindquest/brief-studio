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
    keyPrefix: "notes:update",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const user = await requireUser();
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { id } = await params;

  const data: {
    title?: string;
    body?: string;
    colour?: string;
    tag?: string;
    pinned?: boolean;
  } = {};

  if ("title" in body) data.title = asTrimmedString(body.title, 120);
  if ("body" in body) data.body = asTrimmedString(body.body, 12000);
  if ("colour" in body) data.colour = asTrimmedString(body.colour, 24) || "zinc";
  if ("tag" in body) data.tag = asTrimmedString(body.tag, 40);
  if ("pinned" in body) data.pinned = body.pinned === true;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.note.updateMany({
    where: { id, userId: user.id },
    data,
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const note = await prisma.note.findUnique({ where: { id } });
  return NextResponse.json({ note });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "notes:delete",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;

  const user = await requireUser();
  const deleted = await prisma.note.deleteMany({
    where: { id, userId: user.id },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
