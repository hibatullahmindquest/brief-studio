import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser, getCurrentUserWithRole } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const withRole = await getCurrentUserWithRole();

  return (
    <DashboardShell user={user} isAdmin={withRole?.isAdmin ?? false}>
      {children}
    </DashboardShell>
  );
}
