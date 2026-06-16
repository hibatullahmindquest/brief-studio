import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/session";
import { getFeatureRunOwned } from "@/lib/feature-store";
import { getLatestJobForRun } from "@/lib/job-store";

type StoredImage = { kind?: string; aspect?: string; urlPath?: string; scenes?: { no: number; caption: string }[] };
type StoredOutput = { image?: StoredImage };

function safeParse<T>(s: string | null): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

// Poll + resume endpoint. Returns the latest generation job for a run, mapped
// to the shape VisualPanel renders. On a successful image job, the image and
// scenes are hydrated from the run's stored output so the client needs no
// second request.
export async function GET(req: NextRequest) {
  const user = await getCurrentUserWithRole();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const featureRunId = req.nextUrl.searchParams.get("featureRunId");
  if (!featureRunId) return NextResponse.json({ error: "Missing featureRunId" }, { status: 400 });

  // Ownership.
  const run = await getFeatureRunOwned(featureRunId, user.id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const job = await getLatestJobForRun(featureRunId, user.id);
  if (!job) return NextResponse.json({ job: null });

  const base = {
    jobId: job.id,
    status: job.status,
    resultKind: job.resultKind,
    reason: job.reason,
    retryable: job.retryable,
    createdAt: job.createdAt.toISOString(), // so the client timer shows true elapsed on resume
  };

  if (job.status === "succeeded" && job.resultKind === "image") {
    const output = safeParse<StoredOutput>(run.outputJson) ?? {};
    const img = output.image ?? {};
    return NextResponse.json({
      job: {
        ...base,
        kind: img.kind ?? "",
        image: img.urlPath ? { urlPath: img.urlPath, aspect: img.aspect ?? "1:1" } : null,
        scenes: Array.isArray(img.scenes) ? img.scenes : [],
        costMyr: job.costMyr,
      },
    });
  }

  return NextResponse.json({ job: base });
}
