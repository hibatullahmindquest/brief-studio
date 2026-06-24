import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { runIntake } from "@/lib/router";
import { studioErrorResponse } from "@/lib/studio-error";
import { logError } from "@/lib/error-log";

// POST /api/studio — the generic intake front door. Thin wrapper: auth + load the
// user's lens scope (teamRole/team), then hand off to runIntake (all logic + persistence).
// Any authenticated team member may call it; lens scope is enforced inside resolveLens.
export async function POST(req: NextRequest) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // lens scope needs teamRole + team (session token doesn't carry team)
  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, teamRole: true, team: true },
  });
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const result = await runIntake(dbUser, {
      brandSlug: body.brandSlug,
      text: body.text,
      uploads: Array.isArray(body.uploads) ? body.uploads : undefined,
      explicitLens: body.explicitLens,
    });
    return NextResponse.json(result);
  } catch (e) {
    // 400-class StudioErrors map straight through
    const mapped = studioErrorResponse(e);
    if (mapped) return mapped;
    // anything else (incl. OpenAI failures) → log + 502 retryable, never a raw 500
    await logError({ source: "studio.intake", error: e, httpStatus: 502 });
    return NextResponse.json({ error: "Intake failed — cuba semula", retryable: true }, { status: 502 });
  }
}
