import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getCurrentUserWithRole } from "@/lib/session";

export async function GET() {
  await requireUser();
  const brands = await prisma.brand.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      primaryColor: true,
      secondaryColor: true,
      tagline: true,
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(brands);
}

type PatchBody = {
  slug?: string;
  posterFooterLeft?: string;
  posterFooterRight?: string;
  logoSize?: string;
  logoCorner?: string;
};

const LOGO_SIZES = ["sm", "md", "lg"];
const LOGO_CORNERS = ["tl", "tr", "tc"];

// PATCH — admin updates poster-overlay settings (footer text, logo size/corner).
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUserWithRole();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

  const { slug, posterFooterLeft, posterFooterRight, logoSize, logoCorner } = (await req.json().catch(() => ({}))) as PatchBody;
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  if (logoSize !== undefined && !LOGO_SIZES.includes(logoSize)) return NextResponse.json({ error: "Invalid logoSize" }, { status: 400 });
  if (logoCorner !== undefined && !LOGO_CORNERS.includes(logoCorner)) return NextResponse.json({ error: "Invalid logoCorner" }, { status: 400 });

  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const updated = await prisma.brand.update({
    where: { slug },
    data: {
      ...(posterFooterLeft !== undefined ? { posterFooterLeft: posterFooterLeft.slice(0, 120) } : {}),
      ...(posterFooterRight !== undefined ? { posterFooterRight: posterFooterRight.slice(0, 120) } : {}),
      ...(logoSize !== undefined ? { logoSize } : {}),
      ...(logoCorner !== undefined ? { logoCorner } : {}),
    },
    select: { slug: true, posterFooterLeft: true, posterFooterRight: true, logoSize: true, logoCorner: true },
  });

  return NextResponse.json(updated);
}
