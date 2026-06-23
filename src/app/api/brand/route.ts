import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getCurrentUserWithRole } from "@/lib/session";
import { adminErrorResponse } from "@/lib/admin/errors";
import { updateBrand } from "@/lib/admin/brands";

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

// PATCH — admin updates poster-overlay furniture (footer, logo size/corner) AND
// M1 enriched brand knowledge. Validation + persistence live in lib/admin/brands.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUserWithRole();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const updated = await updateBrand(body);
    return NextResponse.json(updated);
  } catch (e) {
    const res = adminErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
