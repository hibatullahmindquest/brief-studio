import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { listLibrary } from "@/lib/artifact-store";

// GET /api/library?limit=&cursor= — artifact-based Recent/Library list (Module 1 Phase F).
// Owner-scoped; only runs with ≥1 artifact. Distinct from the legacy /api/history (outputJson).
export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const parsed = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Math.min(isNaN(parsed) ? 20 : parsed, 50);
  const items = await listLibrary(user.id, { limit, cursor });
  return NextResponse.json(items);
}
