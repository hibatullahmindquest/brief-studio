import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/session";
import { getUsageSummary } from "@/lib/usage";

// GET /api/usage — admin-only AI cost summary. Never exposes API keys.
export async function GET() {
  try {
    await assertAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const summary = await getUsageSummary();
  return NextResponse.json(summary);
}
