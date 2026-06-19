import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { BrandFurnitureForm, type BrandFurniture } from "@/components/BrandFurnitureForm";

export const metadata: Metadata = {
  title: "Brand Furniture",
  description: "Manage poster logo and footer overlay per brand.",
};

export default async function BrandFurniturePage() {
  await requireAdmin();

  let brands: BrandFurniture[] = [];
  try {
    const rows = await prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { slug: true, name: true, logoUrlLight: true, logoUrlDark: true, logoSize: true, logoCorner: true, posterFooterLeft: true, posterFooterRight: true, primaryColor: true },
    });
    brands = rows.map((b) => ({
      slug: b.slug,
      name: b.name,
      logoUrlLight: b.logoUrlLight ?? null,
      logoUrlDark: b.logoUrlDark ?? null,
      logoSize: (b.logoSize as "sm" | "md" | "lg") ?? "md",
      logoCorner: (b.logoCorner as "tl" | "tr" | "tc") ?? "tl",
      posterFooterLeft: b.posterFooterLeft ?? "",
      posterFooterRight: b.posterFooterRight ?? "",
      primaryColor: b.primaryColor,
    }));
  } catch {
    // Keep the page available even when the DB is unreachable.
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#7b8698] hover:text-[#00262a]"
      >
        ← Settings
      </Link>

      <section className="editorial-panel rounded-3xl p-5 sm:p-6">
        <p className="editorial-kicker">Brand</p>
        <h1 className="editorial-title mt-3 text-2xl sm:text-3xl">Logo &amp; footer poster</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          Logo &amp; footer di sini ditambah secara overlay ke setiap poster yang dijana — bukan oleh AI, dibaca masa generate.
        </p>
      </section>

      {brands.length === 0 ? (
        <p className="rounded-3xl border border-[var(--line)] bg-white p-5 text-sm text-[#7b8698]">
          Tiada brand aktif.
        </p>
      ) : (
        brands.map((b) => <BrandFurnitureForm key={b.slug} brand={b} />)
      )}
    </div>
  );
}
