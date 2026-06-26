// A readable, reference-friendly run title: "<Type> — <short purpose>", derived from the task
// type + the AI-generated one-line intent. Computed in the read layer (no stored column needed),
// so existing runs get good titles too and it stays current if the task type changes. A stored
// CreativeRun.title (e.g. a future user-edited name) takes precedence — see the read layer.

const TYPE_LABEL: Record<string, string> = {
  poster: "Poster",
  caption: "Caption",
  marketing_plan: "Marketing plan",
  storyboard: "Storyboard",
  video_script: "Video script",
};

import { fixBrandCase } from "@/lib/copy-format";

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function buildRunTitle(feature: string, intent?: string | null, brandName?: string | null): string {
  const type = TYPE_LABEL[feature] ?? (feature && feature !== "unknown" ? titleCase(feature) : "Run");
  let purpose = fixBrandCase((intent ?? "").trim().replace(/\s+/g, " "), brandName);
  // drop a redundant leading type word ("Poster promoting…" → "promoting…")
  purpose = purpose.replace(new RegExp(`^${type}\\s+`, "i"), "").trim();
  if (purpose.length > 60) purpose = purpose.slice(0, 57).replace(/\s+\S*$/, "") + "…";
  return purpose ? `${type} — ${purpose}` : type;
}
