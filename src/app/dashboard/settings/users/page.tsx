import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { listUsers } from "@/lib/admin/users";
import { UsersAdmin, type UserRow } from "@/components/admin/UsersAdmin";

export const metadata: Metadata = {
  title: "Team",
  description: "Assign team roles, lens scope, and admin access.",
};

export default async function UsersPage() {
  const me = await requireAdmin();

  let users: UserRow[] = [];
  try {
    const rows = await listUsers();
    users = rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      teamRole: u.teamRole,
      team: u.team,
      isAdmin: u.isAdmin,
    }));
  } catch {
    // Keep the page available even when the DB is unreachable.
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#7b8698] hover:text-[#00262a]"
      >
        ← Settings
      </Link>

      <section className="editorial-panel rounded-3xl p-5 sm:p-6">
        <p className="editorial-kicker">Admin</p>
        <h1 className="editorial-title mt-3 text-2xl sm:text-3xl">Team</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          Assign each member a team role and lens scope, and grant or revoke admin access. The
          last admin cannot be demoted — grant admin to someone else first.
        </p>
      </section>

      <UsersAdmin initial={users} selfId={me.id} />
    </div>
  );
}
