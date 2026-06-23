import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/session";
import { adminErrorResponse } from "@/lib/admin/errors";
import { listExperts, createExpert, updateExpert, deleteExpert } from "@/lib/admin/experts";

// Admin-only CRUD for Experts. assertAdmin() throws a Response on failure → return it.
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
  return NextResponse.json(await listExperts());
}

export async function POST(req: NextRequest) {
  const denied = await gate();
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const expert = await createExpert(body);
    return NextResponse.json(expert, { status: 201 });
  } catch (e) {
    const res = adminErrorResponse(e);
    if (res) return res;
    throw e;
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await gate();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  try {
    const body = await req.json().catch(() => ({}));
    const expert = await updateExpert(id, body);
    return NextResponse.json(expert);
  } catch (e) {
    const res = adminErrorResponse(e);
    if (res) return res;
    throw e;
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await gate();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  try {
    const result = await deleteExpert(id);
    return NextResponse.json(result);
  } catch (e) {
    const res = adminErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
