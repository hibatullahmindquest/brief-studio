import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const DATABASE_UNAVAILABLE_MARKERS = [
  "unable to open database file",
  "Error querying the database",
  "Can't reach database server",
  "connect ECONNREFUSED",
  "no such table",
  "P1001",
  "P2021",
];

export function isDatabaseUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return DATABASE_UNAVAILABLE_MARKERS.some((marker) => message.includes(marker));
}
