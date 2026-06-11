import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getRecentFeatureRuns } from "@/lib/feature-store";

export async function GET() {
  const user = await requireUser();
  const runs = await getRecentFeatureRuns(user.id);
  return NextResponse.json(runs);
}
