import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isMetaConfigured } from "@/lib/meta";
import { isEncryptionConfigured } from "@/lib/crypto";
import { MetaConnectionsPanel } from "./meta-connections-panel";

export const metadata: Metadata = {
  title: "Meta Connections",
  description: "Connect Facebook Page, Instagram, and ad accounts per brand.",
};

export default async function MetaSettingsPage() {
  // Admin-only. Non-admins are redirected by requireAdmin.
  await requireAdmin();

  const brands = await prisma.brand.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  const connections = await prisma.metaConnection.findMany({
    select: {
      id: true,
      brandId: true,
      type: true,
      externalId: true,
      name: true,
      status: true,
      tokenExpiry: true,
      lastSyncedAt: true,
      lastError: true,
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const brandsWithConnections = brands.map((b) => ({
    ...b,
    connections: connections
      .filter((c) => c.brandId === b.id)
      .map((c) => ({
        id: c.id,
        type: c.type,
        externalId: c.externalId,
        name: c.name,
        status: c.status,
        tokenExpiry: c.tokenExpiry ? c.tokenExpiry.toISOString() : null,
        lastSyncedAt: c.lastSyncedAt ? c.lastSyncedAt.toISOString() : null,
        lastError: c.lastError,
      })),
  }));

  return (
    <div className="space-y-6">
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <p className="editorial-kicker">Settings · Integrations</p>
        <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">Meta connections</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          Connect each brand&apos;s Facebook Page, Instagram account, and ad accounts. Tokens are
          encrypted at rest and never shown — only connection status is visible.
        </p>
      </section>

      <MetaConnectionsPanel
        brands={brandsWithConnections}
        metaConfigured={isMetaConfigured()}
        encryptionConfigured={isEncryptionConfigured()}
      />
    </div>
  );
}
