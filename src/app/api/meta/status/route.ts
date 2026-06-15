import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

// GET /api/meta/status?brandId=... — masked connection health.
// Any authenticated user may read this; tokens are NEVER included.
export async function GET(req: NextRequest) {
  await requireUser();

  const brandId = req.nextUrl.searchParams.get("brandId");
  if (!brandId) {
    return NextResponse.json({ error: "Missing brandId" }, { status: 400 });
  }

  const connections = await prisma.metaConnection.findMany({
    where: { brandId },
    select: {
      id: true,
      type: true,
      externalId: true,
      name: true,
      status: true,
      tokenExpiry: true,
      lastSyncedAt: true,
      lastError: true,
      // tokenEnc deliberately omitted
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const now = Date.now();
  const masked = connections.map((c) => ({
    ...c,
    needsReauth: c.tokenExpiry ? c.tokenExpiry.getTime() < now : false,
  }));

  return NextResponse.json({ brandId, connections: masked });
}
