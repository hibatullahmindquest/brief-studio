// SCIS visual generation worker — bootstrap.
//
// Loads .env.local FIRST (so DATABASE_URL / OPENAI_API_KEY are set before the
// Prisma client and OpenAI client modules are constructed at import time), then
// hands off to the poll loop via dynamic import.
//
// Run:  npm run worker   (→ tsx watch src/worker/index.ts)
// VPS:  pm2 start npm --name scis-worker -- run worker   (later — see PRD)
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env.local");
} catch {
  // .env.local may be absent if env is provided by the process manager (e.g. PM2).
  console.warn("[worker] no .env.local found — relying on inherited environment");
}

// Dynamic import AFTER env is loaded (loadEnvFile is synchronous) so the loop's
// module-eval-time env reads see the values. No top-level await — tsx transforms
// this entry as CJS, where top-level await is unsupported.
import("./loop").catch((err) => {
  console.error("[worker] failed to start:", err);
  process.exit(1);
});
