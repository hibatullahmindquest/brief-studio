import { NextResponse } from "next/server";

// Typed error carried out of the studio/router lib so the route can map it to an HTTP
// status without leaking internals. Mirrors the admin AdminError pattern, kept separate
// so studio libs don't depend on the admin module.
export class StudioError extends Error {
  status: number;
  retryable: boolean;
  constructor(status: number, message: string, retryable = false) {
    super(message);
    this.status = status;
    this.retryable = retryable;
    this.name = "StudioError";
  }
}

export function isStudioError(e: unknown): e is StudioError {
  return e instanceof StudioError;
}

// Map a thrown value to a JSON error response when it is a StudioError; otherwise null
// so the caller can rethrow (real 500s stay loud).
export function studioErrorResponse(e: unknown): NextResponse | null {
  if (isStudioError(e)) {
    const body: { error: string; retryable?: boolean } = { error: e.message };
    if (e.retryable) body.retryable = true;
    return NextResponse.json(body, { status: e.status });
  }
  return null;
}
