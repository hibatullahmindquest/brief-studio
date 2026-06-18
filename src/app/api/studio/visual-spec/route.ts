import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/session";
import {
  getFeatureRunOwned,
  updateFeatureRunInput,
  setFeatureRunStatus,
  saveFeatureRun,
} from "@/lib/feature-store";
import { getBrandContext } from "@/lib/brand-context";
import { planSpec, type VisualSpec } from "@/lib/visual";
import { logUsage } from "@/lib/usage";
import { logError } from "@/lib/error-log";
import { OUTPUT_TYPES } from "@/lib/conversation-engine";
import { enforceRateLimit } from "@/lib/rate-limit";

// Strip placeholder artifacts (angle brackets, surrounding quotes, markdown) from
// manual spec edits so they never reach the image prompt — mirrors visual.ts.
function sanitize(s: unknown): string {
  return String(s ?? "")
    .replace(/^[\s"'`<>(\[]+|[\s"'`<>)\]]+$/g, "")
    .replace(/\*\*/g, "")
    .trim();
}
const TEXT_FIELDS: (keyof VisualSpec)[] = ["headline", "accent", "cta", "concept", "angle", "style", "mood"];

type PostBody = { featureRunId?: string; brandSlug?: string; brief?: string; gaps?: string };
type PutBody = { featureRunId?: string; patch?: Partial<VisualSpec> };
type StoredInput = { brandSlug?: string; contentType?: string; visualSpec?: VisualSpec; [k: string]: unknown };

const POSTER_LABEL = OUTPUT_TYPES.find((o) => o.id === "poster")?.label ?? "Poster";

function parse(s: string | null): StoredInput {
  if (!s) return {};
  try { return JSON.parse(s) as StoredInput; } catch { return {}; }
}

function gate(user: Awaited<ReturnType<typeof getCurrentUserWithRole>>) {
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin && user.teamRole !== "creative") {
    return NextResponse.json({ error: "Forbidden — creative or admin only" }, { status: 403 });
  }
  return null;
}

// GET — load an existing run's Creative Spec (used to re-open a Draft for editing).
export async function GET(req: NextRequest) {
  const user = await getCurrentUserWithRole();
  const denied = gate(user);
  if (denied) return denied;

  const featureRunId = req.nextUrl.searchParams.get("featureRunId");
  if (!featureRunId) return NextResponse.json({ error: "Missing featureRunId" }, { status: 400 });

  const run = await getFeatureRunOwned(featureRunId, user!.id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const input = parse(run.inputJson);
  return NextResponse.json({
    featureRunId,
    brandSlug: input.brandSlug ?? null,
    spec: input.visualSpec ?? null,
    status: run.status,
  });
}

// POST — synthesise a Creative Spec from the user's free-text brief (angle-aware).
// Creates the Draft run if no featureRunId is given (the guided-brief entry point),
// otherwise re-synthesises for the existing run. Marks the run a Draft.
export async function POST(req: NextRequest) {
  const rl = enforceRateLimit(req, { keyPrefix: "studio:spec", limit: 30, windowMs: 10 * 60 * 1000 });
  if (rl) return rl;

  const user = await getCurrentUserWithRole();
  const denied = gate(user);
  if (denied) return denied;

  const { featureRunId, brandSlug: bodySlug, brief, gaps } = (await req.json().catch(() => ({}))) as PostBody;

  // Resolve the run (existing) or the brand (for a fresh draft).
  let runId = featureRunId ?? null;
  let input: StoredInput;
  let slug: string | undefined;

  if (runId) {
    const run = await getFeatureRunOwned(runId, user!.id);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    input = parse(run.inputJson);
    slug = input.brandSlug;
  } else {
    slug = bodySlug;
    input = { brandSlug: slug, contentType: POSTER_LABEL };
  }
  if (!slug) return NextResponse.json({ error: "Missing brand" }, { status: 400 });

  const brand = await getBrandContext(slug);
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  try {
    const { spec, usage } = await planSpec({ brief: brief ?? "", brand, outputTypeId: "poster", gaps });

    // Create the draft run lazily on first synthesis so abandoned briefs never
    // leave an empty run behind.
    if (!runId) {
      const created = await saveFeatureRun({
        userId: user!.id,
        feature: "generate",
        subtype: POSTER_LABEL,
        input: { brandSlug: slug, brandId: brand.id, contentType: POSTER_LABEL, visualSpec: spec },
        output: {},
      });
      runId = created.id;
    } else {
      await updateFeatureRunInput(runId, { ...input, brandId: brand.id, contentType: POSTER_LABEL, visualSpec: spec });
    }

    await setFeatureRunStatus(runId, "draft");
    await logUsage({
      userId: user!.id, brandId: brand.id, featureRunId: runId,
      module: "visual", model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
    });

    return NextResponse.json({ featureRunId: runId, spec });
  } catch (err) {
    await logError({ source: "studio.visual-spec", error: err, userId: user!.id, brandId: brand.id, featureRunId: runId, context: {} });
    return NextResponse.json({ error: "Gagal sediakan spec — masalah AI. Cuba semula." }, { status: 502 });
  }
}

// PUT — persist manual edits to the spec (headline/accent/cta/style/mood/concept/ratio).
// Editing reverts the run to Draft so the Generate gate requires a fresh Sahkan.
export async function PUT(req: NextRequest) {
  const rl = enforceRateLimit(req, { keyPrefix: "studio:spec-edit", limit: 60, windowMs: 10 * 60 * 1000 });
  if (rl) return rl;

  const user = await getCurrentUserWithRole();
  const denied = gate(user);
  if (denied) return denied;

  const { featureRunId, patch } = (await req.json().catch(() => ({}))) as PutBody;
  if (!featureRunId) return NextResponse.json({ error: "Missing featureRunId" }, { status: 400 });
  if (!patch || typeof patch !== "object") return NextResponse.json({ error: "Missing patch" }, { status: 400 });

  const run = await getFeatureRunOwned(featureRunId, user!.id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const input = parse(run.inputJson);
  if (!input.visualSpec) return NextResponse.json({ error: "No spec yet" }, { status: 400 });

  // Sanitize text fields from the client so manual edits match synth/regenerate
  // hygiene (no stray brackets/markdown reach the image prompt verbatim).
  const cleanedPatch: Partial<VisualSpec> = { ...patch };
  for (const f of TEXT_FIELDS) {
    if (typeof cleanedPatch[f] === "string") cleanedPatch[f] = sanitize(cleanedPatch[f]) as never;
  }
  const nextSpec: VisualSpec = { ...input.visualSpec, ...cleanedPatch };
  await updateFeatureRunInput(featureRunId, { ...input, visualSpec: nextSpec });
  await setFeatureRunStatus(featureRunId, "draft");

  return NextResponse.json({ spec: nextSpec });
}
