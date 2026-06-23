import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/session";
import { adminErrorResponse } from "@/lib/admin/errors";
import { listRecipes, createRecipe, updateRecipe, deleteRecipe } from "@/lib/admin/recipes";

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
  return NextResponse.json(await listRecipes());
}

export async function POST(req: NextRequest) {
  const denied = await gate();
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const recipe = await createRecipe(body);
    return NextResponse.json(recipe, { status: 201 });
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
    const recipe = await updateRecipe(id, body);
    return NextResponse.json(recipe);
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
    const result = await deleteRecipe(id);
    return NextResponse.json(result);
  } catch (e) {
    const res = adminErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
