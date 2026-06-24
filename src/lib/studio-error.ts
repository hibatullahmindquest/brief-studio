import { NextResponse } from "next/server";

// Typed error carried out of the studio/router lib so the route can map it to an HTTP
// status without leaking internals. Mirrors the admin AdminError pattern, kept separate
// so studio libs don't depend on the admin module.
export class StudioError extends Error {
  status: number;
  retryable: boolean;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, retryable = false, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.retryable = retryable;
    this.extra = extra;
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
    const body: { error: string; retryable?: boolean } & Record<string, unknown> = { error: e.message };
    if (e.retryable) body.retryable = true;
    if (e.extra) Object.assign(body, e.extra);
    return NextResponse.json(body, { status: e.status });
  }
  return null;
}

// Recipe-engine config failure (no recipe / no grounding / no enabled producing
// experts). Distinct from transient OpenAI errors so the worker handler can mark it
// NON-retryable (a re-run won't fix a misconfigured recipe). Mirrors StudioError.
export class RecipeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecipeConfigError";
  }
}

export function isRecipeConfigError(e: unknown): e is RecipeConfigError {
  return e instanceof RecipeConfigError;
}
