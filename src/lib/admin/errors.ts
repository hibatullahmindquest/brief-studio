import { NextResponse } from "next/server";

// Typed error carried out of admin lib functions so route handlers can map it to an
// HTTP status without leaking Prisma internals. Status drives the response code.
export class AdminError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AdminError";
  }
}

export function isAdminError(e: unknown): e is AdminError {
  return e instanceof AdminError;
}

// Map a thrown value to a JSON error response when it is an AdminError; otherwise
// return null so the caller can rethrow (real 500s stay loud).
export function adminErrorResponse(e: unknown): NextResponse | null {
  if (isAdminError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
  return null;
}
