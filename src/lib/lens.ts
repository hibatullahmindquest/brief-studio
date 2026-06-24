import { StudioError } from "./studio-error";

// Lens = the interpretation context that shapes how a brief is understood and which
// recipe variant serves it. Distinct from teamRole (which is *who you are* / access).
// Resolution is deterministic and scope-enforced — the LLM never decides the lens.
//   marketing = paid/campaign/strategy framing
//   social    = organic, publish-ready content
// (social_memo is parked — see brainstorm Future/KIV.)

export const LENSES = ["marketing", "social"] as const;
export type Lens = (typeof LENSES)[number];

export function isLens(v: unknown): v is Lens {
  return typeof v === "string" && (LENSES as readonly string[]).includes(v);
}

// teamRole → default lens (no defaultLens column; derived).
function defaultLensFor(teamRole: string): Lens {
  return teamRole === "creative" ? "social" : "marketing";
}

// Lens scope by User.team:
//   single        → locked to the teamRole default (explicit ignored)
//   multi (HOD)   → may pick either lens
//   all   (admin) → may pick either lens
export function resolveLens(user: { teamRole: string; team: string }, explicit?: string): Lens {
  if (explicit !== undefined && !isLens(explicit)) {
    throw new StudioError(400, `Invalid lens: ${explicit}`);
  }
  const fallback = defaultLensFor(user.teamRole);
  if (user.team === "single") return fallback; // locked — explicit deliberately ignored
  return isLens(explicit) ? explicit : fallback;
}
