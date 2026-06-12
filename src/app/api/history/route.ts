import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getRecentFeatureRuns } from "@/lib/feature-store";

export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const parsedLimit = parseInt(searchParams.get("limit") ?? "10", 10);
  const limit = Math.min(isNaN(parsedLimit) ? 10 : parsedLimit, 50);
  const runs = await getRecentFeatureRuns(user.id, limit, cursor);
  return NextResponse.json(runs);
}
