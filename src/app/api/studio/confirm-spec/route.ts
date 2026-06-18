import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/session";
import { getFeatureRunOwned, setFeatureRunStatus } from "@/lib/feature-store";
import { enforceRateLimit } from "@/lib/rate-limit";

type Body = { featureRunId?: string };
type StoredInput = { visualSpec?: unknown };

// Confirm the Creative Spec ("Sahkan Idea") — gates the Generate button.
export async function POST(req: NextRequest) {
  const rl = enforceRateLimit(req, { keyPrefix: "studio:confirm", limit: 40, windowMs: 10 * 60 * 1000 });
  if (rl) return rl;

  const user = await getCurrentUserWithRole();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin && user.teamRole !== "creative") {
    return NextResponse.json({ error: "Forbidden — creative or admin only" }, { status: 403 });
  }

  const { featureRunId } = (await req.json().catch(() => ({}))) as Body;
  if (!featureRunId) return NextResponse.json({ error: "Missing featureRunId" }, { status: 400 });

  const run = await getFeatureRunOwned(featureRunId, user.id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  let hasSpec = false;
  try { hasSpec = !!(JSON.parse(run.inputJson ?? "{}") as StoredInput).visualSpec; } catch { hasSpec = false; }
  if (!hasSpec) return NextResponse.json({ error: "No spec to confirm" }, { status: 400 });

  await setFeatureRunStatus(featureRunId, "confirmed");
  return NextResponse.json({ status: "confirmed" });
}
