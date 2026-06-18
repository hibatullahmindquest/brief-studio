import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/session";
import { getFeatureRunOwned, updateFeatureRunInput, setFeatureRunStatus } from "@/lib/feature-store";
import { getBrandContext } from "@/lib/brand-context";
import { planSpec } from "@/lib/visual";
import { logUsage } from "@/lib/usage";
import { OUTPUT_TYPES } from "@/lib/conversation-engine";
import { enforceRateLimit } from "@/lib/rate-limit";

type Body = { featureRunId?: string; brief?: string; gaps?: string };
type StoredInput = { brandSlug?: string; contentType?: string; [k: string]: unknown };

function parse(s: string | null): StoredInput {
  if (!s) return {};
  try { return JSON.parse(s) as StoredInput; } catch { return {}; }
}

// Synthesise a Creative Spec from the user's free-text brief (angle-aware).
// Persists it into the run (inputJson.visualSpec) and marks the run a Draft.
export async function POST(req: NextRequest) {
  const rl = enforceRateLimit(req, { keyPrefix: "studio:spec", limit: 30, windowMs: 10 * 60 * 1000 });
  if (rl) return rl;

  const user = await getCurrentUserWithRole();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin && user.teamRole !== "creative") {
    return NextResponse.json({ error: "Forbidden — creative or admin only" }, { status: 403 });
  }

  const { featureRunId, brief, gaps } = (await req.json().catch(() => ({}))) as Body;
  if (!featureRunId) return NextResponse.json({ error: "Missing featureRunId" }, { status: 400 });

  const run = await getFeatureRunOwned(featureRunId, user.id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const input = parse(run.inputJson);
  if (!input.brandSlug) return NextResponse.json({ error: "Run has no brand" }, { status: 400 });
  const brand = await getBrandContext(input.brandSlug);
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  const outputTypeId = OUTPUT_TYPES.find((o) => o.label === input.contentType)?.id ?? "poster";

  const { spec, usage } = await planSpec({ brief: brief ?? "", brand, outputTypeId, gaps });

  await updateFeatureRunInput(featureRunId, { ...input, visualSpec: spec });
  await setFeatureRunStatus(featureRunId, "draft");
  await logUsage({
    userId: user.id, brandId: brand.id, featureRunId,
    module: "visual", model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
  });

  return NextResponse.json({ spec });
}
