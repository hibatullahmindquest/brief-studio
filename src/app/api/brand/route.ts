import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

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
