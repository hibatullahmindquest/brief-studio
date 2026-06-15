"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Connection = {
  id: string;
  type: string;
  externalId: string;
  name: string;
  status: string;
  tokenExpiry: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};

type Brand = {
  id: string;
  name: string;
  slug: string;
  connections: Connection[];
};

const STATUS_MESSAGES: Record<string, { text: string; tone: "ok" | "warn" | "stop" }> = {
  connected: { text: "Meta connected successfully.", tone: "ok" },
  denied: { text: "Connection cancelled — permission was not granted.", tone: "warn" },
  expired: { text: "The connection link expired. Try again.", tone: "warn" },
  invalid: { text: "Invalid request. Try again.", tone: "stop" },
  no_key: { text: "META_TOKEN_KEY is not set — cannot store tokens securely.", tone: "stop" },
  error: { text: "Something went wrong talking to Meta. Try again.", tone: "stop" },
};

const TYPE_LABELS: Record<string, string> = {
  page: "Facebook Page",
  instagram: "Instagram",
  ad_account: "Ad account",
};

function StatusPill({ connection }: { connection: Connection }) {
  let tone = "ok";
  let label = "Connected";
  if (connection.status === "needs_reauth") {
    tone = "warn";
    label = "Needs reconnect";
  } else if (connection.status === "error") {
    tone = "stop";
    label = "Error";
  } else if (connection.status === "not_linked") {
    tone = "warn";
    label = "Not linked";
  }
  const colors: Record<string, string> = {
    ok: "bg-emerald-100 text-emerald-700",
    warn: "bg-amber-100 text-amber-700",
    stop: "bg-red-100 text-red-700",
  };
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${colors[tone]}`}>{label}</span>
  );
}

export function MetaConnectionsPanel({
  brands,
  metaConfigured,
  encryptionConfigured,
}: {
  brands: Brand[];
  metaConfigured: boolean;
  encryptionConfigured: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const metaStatus = searchParams.get("meta");
  const [confirmBrand, setConfirmBrand] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const blocked = !metaConfigured || !encryptionConfigured;

  async function disconnect(brandId: string) {
    setBusy(true);
    try {
      await fetch("/api/meta/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });
      setConfirmBrand(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {metaStatus && STATUS_MESSAGES[metaStatus] && (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            STATUS_MESSAGES[metaStatus].tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : STATUS_MESSAGES[metaStatus].tone === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {STATUS_MESSAGES[metaStatus].text}
        </div>
      )}

      {blocked && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {!metaConfigured && <p>Meta app not configured — set META_APP_ID, META_APP_SECRET, META_REDIRECT_URI.</p>}
          {!encryptionConfigured && (
            <p>META_TOKEN_KEY not set — generate one with <code>openssl rand -base64 32</code> before connecting.</p>
          )}
        </div>
      )}

      {brands.length === 0 && (
        <p className="text-sm editorial-muted">No active brands yet. Create a brand first.</p>
      )}

      {brands.map((brand) => (
        <section key={brand.id} className="editorial-panel rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{brand.name}</h2>
              <p className="text-xs editorial-muted">{brand.connections.length} connection(s)</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={blocked ? undefined : `/api/meta/connect?brandId=${brand.id}`}
                aria-disabled={blocked}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  blocked
                    ? "pointer-events-none bg-zinc-200 text-zinc-400"
                    : "bg-[#3b4ee2] text-white hover:bg-[#304bd4]"
                }`}
              >
                {brand.connections.length ? "Reconnect" : "Connect Meta"}
              </a>
              {brand.connections.length > 0 && (
                <button
                  onClick={() => setConfirmBrand(brand.id)}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {brand.connections.length > 0 && (
            <div className="mt-4 space-y-2">
              {brand.connections.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-white/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      <span className="editorial-muted">{TYPE_LABELS[c.type] ?? c.type}</span>
                      {c.name ? ` · ${c.name}` : ""}
                    </p>
                    <p className="truncate font-mono text-xs editorial-muted">
                      {c.externalId}
                      {c.lastSyncedAt ? ` · synced ${new Date(c.lastSyncedAt).toLocaleString()}` : " · never synced"}
                    </p>
                  </div>
                  <StatusPill connection={c} />
                </div>
              ))}
            </div>
          )}

          {confirmBrand === brand.id && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">
                Disconnect all Meta connections for <strong>{brand.name}</strong>? Cached analytics stay,
                but syncing stops until you reconnect.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => disconnect(brand.id)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {busy ? "Disconnecting…" : "Yes, disconnect"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => setConfirmBrand(null)}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
