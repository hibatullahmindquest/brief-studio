// Exponential backoff for retries: 30s, 60s, 120s … capped at 10 min.
const BASE_MS = 30_000;
const CAP_MS = 10 * 60_000;

export function backoffMs(attempts: number): number {
  return Math.min(CAP_MS, BASE_MS * 2 ** Math.max(0, attempts - 1));
}

export function nextScheduledAt(attempts: number, now = new Date()): Date {
  return new Date(now.getTime() + backoffMs(attempts));
}
