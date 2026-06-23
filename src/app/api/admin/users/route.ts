import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/session";
import { adminErrorResponse } from "@/lib/admin/errors";
import { listUsers, updateUser } from "@/lib/admin/users";

// Admin-only team assignment for Users. assertAdmin() throws a Response on failure → return it.
// Only teamRole/team/isAdmin are accepted; credential fields are never read from the body.
async function gate(): Promise<Response | null> {
  try {
    await assertAdmin();
    return null;
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function GET() {
  const denied = await gate();
  if (denied) return denied;
  return NextResponse.json(await listUsers());
}

export async function PATCH(req: NextRequest) {
  const denied = await gate();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  try {
    const body = await req.json().catch(() => ({}));
    // Whitelist: ignore anything but the three assignment fields.
    const user = await updateUser(id, {
      teamRole: body.teamRole,
      team: body.team,
      isAdmin: body.isAdmin,
    });
    return NextResponse.json(user);
  } catch (e) {
    const res = adminErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
