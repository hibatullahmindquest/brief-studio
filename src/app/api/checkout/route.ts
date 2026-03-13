import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { enforceRateLimit } from "@/lib/rate-limit";

const ALLOWED_PLANS = new Set(["starter", "pro", "business"]);

export async function POST(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "checkout:create-session",
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json();
    const plan: string = typeof body.plan === "string" ? body.plan : "";

    if (!ALLOWED_PLANS.has(plan)) {
      return NextResponse.json({ error: "Invalid plan selected" }, { status: 400 });
    }

    const requestUrl = new URL(req.url);
    const origin = req.headers.get("origin") || requestUrl.origin;

    const url = await createCheckoutSession(plan, origin);
    return NextResponse.json({ url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message || "checkout error" }, { status: 500 });
  }
}
