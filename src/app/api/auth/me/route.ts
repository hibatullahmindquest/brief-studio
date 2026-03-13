import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(user || null, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
