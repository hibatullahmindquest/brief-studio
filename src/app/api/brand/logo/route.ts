import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/session";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// POST (multipart) — admin uploads a brand logo PNG used by the poster overlay.
// Stored at public/uploads/brand/<slug>-logo.png and recorded in Brand.logoUrl.
export async function POST(req: NextRequest) {
  const user = await getCurrentUserWithRole();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }

  const slug = String(form.get("slug") ?? "");
  const file = form.get("file");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Logo terlalu besar (max 2MB)" }, { status: 413 });

  const brand = await prisma.brand.findUnique({ where: { slug }, select: { id: true } });
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const raw = Buffer.from(await file.arrayBuffer());
  // PNG signature check, then re-encode through sharp to guarantee a clean PNG
  // (transparent, stripped metadata) and reject anything that isn't a real image.
  const isPng = raw.length > 8 && raw[0] === 0x89 && raw[1] === 0x50 && raw[2] === 0x4e && raw[3] === 0x47;
  if (!isPng) return NextResponse.json({ error: "Logo mesti fail PNG transparan" }, { status: 415 });

  let png: Buffer;
  try {
    png = await sharp(raw).png().toBuffer();
  } catch {
    return NextResponse.json({ error: "Fail PNG tak sah / rosak" }, { status: 415 });
  }

  const dir = path.join(process.cwd(), "public", "uploads", "brand");
  await mkdir(dir, { recursive: true });
  const filename = `${slug}-logo.png`;
  await writeFile(path.join(dir, filename), png);

  const logoUrl = `/uploads/brand/${filename}`;
  await prisma.brand.update({ where: { slug }, data: { logoUrl } });

  // Cache-bust the preview (file path is stable across re-uploads).
  return NextResponse.json({ logoUrl, version: png.length });
}
