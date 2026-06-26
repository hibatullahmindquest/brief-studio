// Which lane a job kind runs in. interactive = user is waiting (keep it fast);
// background = slow/scheduled work that must not block interactive jobs.
export type Lane = "interactive" | "background";

const KIND_LANE: Record<string, Lane> = {
  generate: "interactive",
  render: "interactive", // on-demand poster render — user is waiting, same lane as generate
  meta_sync: "background",
  analyze: "background",
  video: "background",
  signal: "background",
  export: "background",
};

export function laneForKind(kind: string): Lane {
  return KIND_LANE[kind] ?? "background"; // unknown kinds are background by default
}
