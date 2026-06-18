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

type PatchBody = { slug?: string; posterFooterLeft?: string; posterFooterRight?: string };

// PATCH — admin updates poster-overlay footer text for a brand.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUserWithRole();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

  const { slug, posterFooterLeft, posterFooterRight } = (await req.json().catch(() => ({}))) as PatchBody;
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const updated = await prisma.brand.update({
    where: { slug },
    data: {
      ...(posterFooterLeft !== undefined ? { posterFooterLeft: posterFooterLeft.slice(0, 120) } : {}),
      ...(posterFooterRight !== undefined ? { posterFooterRight: posterFooterRight.slice(0, 120) } : {}),
    },
    select: { slug: true, posterFooterLeft: true, posterFooterRight: true },
  });

  return NextResponse.json(updated);
}
