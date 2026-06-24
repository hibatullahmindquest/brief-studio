import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getRunArtifacts } from "@/lib/artifact-store";

// GET /api/studio/[runId] — the artifact-grouped result view (Module 1 Phase F).
// Owner-scoped; images (carousel) + texts + pdf + per-run cost. Phase G result page consumes this.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { runId } = await params;
  const result = await getRunArtifacts(runId, user.id);
  if (!result) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  return NextResponse.json(result);
}
