import { NextResponse } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
  message?: string;
};

const globalForRateLimit = globalThis as unknown as {
  postforgeRateLimitStore?: Map<string, RateLimitBucket>;
};

const store = globalForRateLimit.postforgeRateLimitStore ?? new Map<string, RateLimitBucket>();

if (!globalForRateLimit.postforgeRateLimitStore) {
  globalForRateLimit.postforgeRateLimitStore = store;
}

function getClientIp(req: Request): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) return xRealIp;

  return "unknown";
}

function cleanupExpiredBuckets(now: number) {
  if (store.size < 500) return;

  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function enforceRateLimit(req: Request, options: RateLimitOptions): NextResponse | null {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const ip = getClientIp(req);
  const key = `${options.keyPrefix}:${ip}`;

  const existing = store.get(key);
  const activeBucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + options.windowMs };

  if (activeBucket.count >= options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((activeBucket.resetAt - now) / 1000));
    return NextResponse.json(
      { error: options.message ?? "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(options.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  activeBucket.count += 1;
  store.set(key, activeBucket);
  return null;
}
