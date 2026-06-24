import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { exportRunToPdf } from "@/lib/export-pdf";
import { logError } from "@/lib/error-log";

// POST /api/studio/[runId]/export — compose the run's text artifacts into a downloadable PDF.
// Thin: auth → exportRunToPdf (owner-scoped, idempotent seam) → map outcome.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { runId } = await params;
  const res = await exportRunToPdf({ runId, userId: user.id });

  if (res.ok && res.skipped) return NextResponse.json({ skipped: true, reason: res.reason });
  if (res.ok) return NextResponse.json({ mediaPath: res.mediaPath, costMyr: res.costMyr });
  if (res.category === "not_found") return NextResponse.json({ error: res.reason }, { status: 404 });

  await logError({ source: "studio.export", error: new Error(res.reason), httpStatus: 502, featureRunId: runId, userId: user.id });
  return NextResponse.json({ error: res.reason, retryable: res.retryable }, { status: 502 });
}
