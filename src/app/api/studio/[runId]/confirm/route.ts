import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { confirmRun } from "@/lib/studio-confirm";
import { studioErrorResponse } from "@/lib/studio-error";
import { logError } from "@/lib/error-log";

// POST /api/studio/[runId]/confirm — move a Phase-C draft run into the recipe engine.
// Thin: auth → confirmRun (owner/state/recipe/gap checks + enqueue) → map StudioError.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { runId } = await params;
  try {
    const result = await confirmRun({ id: user.id }, runId);
    return NextResponse.json(result);
  } catch (e) {
    const mapped = studioErrorResponse(e);
    if (mapped) return mapped;
    await logError({ source: "studio.confirm", error: e, httpStatus: 502 });
    return NextResponse.json({ error: "Confirm failed — cuba semula", retryable: true }, { status: 502 });
  }
}
