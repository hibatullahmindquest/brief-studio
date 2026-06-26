import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/session";
import { logError } from "@/lib/error-log";

// POST /api/studio/upload — stash a brief attachment under /public so the intake ingest can
// read it (ingestUploads is /public-scoped). Returns the public path to pass back in uploads[].
// Accepts the doc/image types the ingest understands; URLs are out of scope (ingest skips them).
const ALLOWED = new Set([".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED.has(ext)) return NextResponse.json({ error: `Unsupported file type: ${ext || "unknown"}` }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "uploads", "briefs");
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}${ext}`;
    await writeFile(path.join(dir, name), buf);

    return NextResponse.json({ path: `/uploads/briefs/${name}`, name: file.name });
  } catch (e) {
    await logError({ source: "studio.upload", error: e, httpStatus: 502, userId: user.id });
    return NextResponse.json({ error: "Upload failed — cuba semula", retryable: true }, { status: 502 });
  }
}
