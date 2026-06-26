import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";

type Lens = "marketing" | "social";

// Phase G — the Studio flow. Auth + shell live in studio/layout.tsx; this page resolves the
// user's lens scope (mirrors resolveLens: creative→social default, others→marketing; team
// "single" locks the picker) and mounts the client orchestrator island.
export default async function StudioPage() {
  const user = await getCurrentUser();
  const dbUser = user
    ? await prisma.user.findUnique({ where: { id: user.id }, select: { teamRole: true, team: true } })
    : null;

  const defaultLens: Lens = dbUser?.teamRole === "creative" ? "social" : "marketing";
  const locked = dbUser?.team === "single";
  const lensOptions: Lens[] = locked ? [defaultLens] : ["marketing", "social"];

  return <StudioWorkspace lensOptions={lensOptions} defaultLens={defaultLens} />;
}
