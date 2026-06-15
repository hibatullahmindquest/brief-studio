import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/session";
import { isMetaConfigured, oauthUrl, signState } from "@/lib/meta";

// GET /api/meta/connect?brandId=... — admin starts the Meta OAuth flow.
export async function GET(req: NextRequest) {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  if (!isMetaConfigured()) {
    return NextResponse.json(
      { error: "Meta is not configured. Set META_APP_ID, META_APP_SECRET, META_REDIRECT_URI." },
      { status: 503 }
    );
  }

  const brandId = req.nextUrl.searchParams.get("brandId");
  if (!brandId) {
    return NextResponse.json({ error: "Missing brandId" }, { status: 400 });
  }

  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const state = signState({ brandId, userId: admin.id });
  return NextResponse.redirect(oauthUrl(state));
}
