import { requireUser, getCurrentUserWithRole } from "@/lib/session";
import { StudioShell } from "@/components/studio/StudioShell";

// Phase G — the Studio shell wraps both the flow page (/studio) and the deep-link
// result page (/studio/[runId]) so they share chrome (nav, header, Recent drawer).
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const withRole = await getCurrentUserWithRole();
  return (
    <StudioShell user={user} isAdmin={withRole?.isAdmin ?? false}>
      {children}
    </StudioShell>
  );
}
