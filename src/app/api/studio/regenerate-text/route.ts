import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/session";
import { getFeatureRunOwned, updateFeatureRunInput } from "@/lib/feature-store";
import { getBrandContext } from "@/lib/brand-context";
import { regenerateSpecText, type VisualSpec } from "@/lib/visual";
import { logUsage } from "@/lib/usage";
import { enforceRateLimit } from "@/lib/rate-limit";

type Field = "headline" | "accent" | "cta";
type Body = { featureRunId?: string; field?: Field };
type StoredInput = { brandSlug?: string; visualSpec?: VisualSpec; [k: string]: unknown };

function parse(s: string | null): StoredInput {
  if (!s) return {};
  try { return JSON.parse(s) as StoredInput; } catch { return {}; }
}

// Regenerate a single Spec text field (headline | accent | cta) — the "↻ Jana semula" action.
export async function POST(req: NextRequest) {
  const rl = enforceRateLimit(req, { keyPrefix: "studio:regen", limit: 40, windowMs: 10 * 60 * 1000 });
  if (rl) return rl;

  const user = await getCurrentUserWithRole();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin && user.teamRole !== "creative") {
    return NextResponse.json({ error: "Forbidden — creative or admin only" }, { status: 403 });
  }

  const { featureRunId, field } = (await req.json().catch(() => ({}))) as Body;
  if (!featureRunId) return NextResponse.json({ error: "Missing featureRunId" }, { status: 400 });
  if (field !== "headline" && field !== "accent" && field !== "cta") {
    return NextResponse.json({ error: "Invalid field" }, { status: 400 });
  }

  const run = await getFeatureRunOwned(featureRunId, user.id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const input = parse(run.inputJson);
  const spec = input.visualSpec;
  if (!spec) return NextResponse.json({ error: "No spec yet" }, { status: 400 });
  if (!input.brandSlug) return NextResponse.json({ error: "Run has no brand" }, { status: 400 });
  const brand = await getBrandContext(input.brandSlug);
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const { value, usage } = await regenerateSpecText({ field, spec, brand });

  const nextSpec: VisualSpec = { ...spec, [field]: value };
  await updateFeatureRunInput(featureRunId, { ...input, visualSpec: nextSpec });
  await logUsage({
    userId: user.id, brandId: brand.id, featureRunId,
    module: "visual", model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
  });

  return NextResponse.json({ field, value });
}
