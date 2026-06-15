import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/session";

// POST /api/meta/disconnect  body: { brandId } — admin removes all Meta
// connections for a brand. Confirmation is enforced in the UI.
export async function POST(req: NextRequest) {
  try {
    await assertAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  let brandId: string | undefined;
  try {
    const body = (await req.json()) as { brandId?: string };
    brandId = body.brandId;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!brandId) {
    return NextResponse.json({ error: "Missing brandId" }, { status: 400 });
  }

  const result = await prisma.metaConnection.deleteMany({ where: { brandId } });
  return NextResponse.json({ disconnected: result.count });
}
