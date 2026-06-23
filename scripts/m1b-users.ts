// Integration checks for Module 1 Phase B — Users (Teams) admin assignment (lib layer).
// Exercises the same functions the API route calls: list/update of assignment fields
// (teamRole/team/isAdmin) + the last-admin demotion guard (409).
// Run: DATABASE_URL=... npx tsx scripts/m1b-users.ts   (exits 1 on any failure)
import { prisma } from "@/lib/prisma";
import { AdminError } from "@/lib/admin/errors";
import { listUsers, updateUser } from "@/lib/admin/users";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function expectAdminError(name: string, status: number, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(`${name} (expected AdminError ${status})`, false);
  } catch (e) {
    ok(name, e instanceof AdminError && e.status === status);
  }
}

// Make a throwaway user. password/username/email are never touched by updateUser.
async function makeUser(suffix: string, isAdmin: boolean) {
  const tag = `zztest_user_${suffix}_${Math.floor(Math.random() * 1e9)}`;
  return prisma.user.create({
    data: {
      email: `${tag}@example.test`,
      username: tag,
      name: `Test ${suffix}`,
      password: "x",
      teamRole: "marketing",
      team: "single",
      isAdmin,
    },
  });
}

async function main() {
  let aId = "";
  let bId = "";
  // Capture pre-existing real admins so we can briefly make test-user A the *only*
  // admin (to exercise the last-admin 409 deterministically) and restore them after.
  const realAdmins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  const realAdminIds = realAdmins.map((u) => u.id);
  const restoreRealAdmins = () =>
    prisma.user.updateMany({ where: { id: { in: realAdminIds } }, data: { isAdmin: true } });

  try {
    // Two throwaway users: A starts as the (test) admin, B as a plain member.
    const a = await makeUser("a", true);
    const b = await makeUser("b", false);
    aId = a.id;
    bId = b.id;

    // list includes both, exposes only safe fields
    const all = await listUsers();
    const aRow = all.find((u) => u.id === aId);
    ok("list includes created users", !!aRow && all.some((u) => u.id === bId));
    ok("list row has assignment fields", !!aRow && aRow.email === a.email && typeof aRow.isAdmin === "boolean");
    ok("list row omits password", aRow !== undefined && !("password" in (aRow as Record<string, unknown>)));

    // update persists teamRole + team
    await updateUser(bId, { teamRole: "creative", team: "multi" });
    const bRead = await prisma.user.findUnique({ where: { id: bId } });
    ok("update persists teamRole+team", bRead?.teamRole === "creative" && bRead?.team === "multi");

    // validation: bad teamRole / team
    await expectAdminError("rejects bad teamRole", 400, () => updateUser(bId, { teamRole: "boss" }));
    await expectAdminError("rejects bad team", 400, () => updateUser(bId, { team: "everyone" }));

    // last-admin guard (deterministic): briefly demote every real admin so A is the
    // sole admin, then demoting A must be blocked. Real admins are restored right after.
    await prisma.user.updateMany({ where: { id: { in: realAdminIds } }, data: { isAdmin: false } });
    ok("A is the only admin for guard check", (await prisma.user.count({ where: { isAdmin: true } })) === 1);
    await expectAdminError("last-admin demotion blocked -> 409", 409, () => updateUser(aId, { isAdmin: false }));
    await restoreRealAdmins();

    // grant admin to B, then demoting A succeeds (A no longer the last admin)
    await updateUser(bId, { isAdmin: true });
    await updateUser(aId, { isAdmin: false });
    const aAfter = await prisma.user.findUnique({ where: { id: aId } });
    ok("demote A succeeds once B is admin", aAfter?.isAdmin === false);

    // update on missing id -> 404
    await expectAdminError("update missing user -> 404", 404, () => updateUser("nonexistent_id", { team: "all" }));
  } finally {
    // Always restore real admins even if an assertion threw mid-guard.
    await restoreRealAdmins().catch(() => {});
    if (aId) await prisma.user.delete({ where: { id: aId } }).catch(() => {});
    if (bId) await prisma.user.delete({ where: { id: bId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { username: { startsWith: "zztest_user_" } } }).catch(() => {});
  }

  console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
