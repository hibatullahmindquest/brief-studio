import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
