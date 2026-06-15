import { createHmac, timingSafeEqual, randomBytes } from "crypto";

// Meta Graph API client + OAuth helpers for SCIS.
// Tokens returned here are plaintext — callers must encrypt via lib/crypto
// before persisting. Never log token values.

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

// Scopes needed for organic insights (Page + IG) and paid metrics (ads_read).
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_insights",
  "ads_read",
  "read_insights",
  "business_management",
];

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function appId() {
  const id = process.env.META_APP_ID;
  if (!id) throw new Error("Missing META_APP_ID");
  return id;
}

function appSecret() {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error("Missing META_APP_SECRET");
  return secret;
}

function redirectUri() {
  const uri = process.env.META_REDIRECT_URI;
  if (!uri) throw new Error("Missing META_REDIRECT_URI");
  return uri;
}

export function isMetaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_REDIRECT_URI);
}

// ── OAuth state signing (CSRF) — HMAC over SESSION_SECRET ────────────

type StatePayload = { brandId: string; userId: string; ts: number; nonce: string };

function stateSecret() {
  return process.env.SESSION_SECRET || "dev-only-session-secret-change-me-before-production";
}

export function signState(input: { brandId: string; userId: string }): string {
  const payload: StatePayload = {
    brandId: input.brandId,
    userId: input.userId,
    ts: Date.now(),
    nonce: randomBytes(8).toString("hex"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): { brandId: string; userId: string } | null {
  const sep = state.lastIndexOf(".");
  if (sep <= 0) return null;

  const body = state.slice(0, sep);
  const providedSig = state.slice(sep + 1);
  const expectedSig = createHmac("sha256", stateSecret()).update(body).digest("base64url");

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
    if (typeof parsed.brandId !== "string" || typeof parsed.userId !== "string" || typeof parsed.ts !== "number") {
      return null;
    }
    if (Date.now() - parsed.ts > STATE_TTL_MS) return null;
    return { brandId: parsed.brandId, userId: parsed.userId };
  } catch {
    return null;
  }
}

// ── OAuth URLs + token exchange ─────────────────────────────────────

export function oauthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: redirectUri(),
    state,
    scope: META_SCOPES.join(","),
    response_type: "code",
  });
  return `${OAUTH_DIALOG}?${params.toString()}`;
}

async function graphGet<T = unknown>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as { error?: { message?: string; code?: number } } & Record<string, unknown>;

  if (!res.ok || json.error) {
    const msg = json.error?.message || `Graph API error (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

export async function exchangeCode(code: string): Promise<string> {
  const data = await graphGet<{ access_token: string }>("/oauth/access_token", {
    client_id: appId(),
    client_secret: appSecret(),
    redirect_uri: redirectUri(),
    code,
  });
  return data.access_token;
}

export async function exchangeLongLived(shortToken: string): Promise<{ token: string; expiresIn: number }> {
  const data = await graphGet<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId(),
    client_secret: appSecret(),
    fb_exchange_token: shortToken,
  });
  return { token: data.access_token, expiresIn: data.expires_in ?? 60 * 24 * 60 * 60 };
}

export type MetaPage = { id: string; name: string; access_token: string };

export async function getPages(userToken: string): Promise<MetaPage[]> {
  const data = await graphGet<{ data: MetaPage[] }>("/me/accounts", {
    access_token: userToken,
    fields: "id,name,access_token",
  });
  return data.data ?? [];
}

export type MetaIgAccount = { id: string; username: string } | null;

export async function getIgAccount(pageId: string, pageToken: string): Promise<MetaIgAccount> {
  const data = await graphGet<{ instagram_business_account?: { id: string; username?: string } }>(`/${pageId}`, {
    access_token: pageToken,
    fields: "instagram_business_account{id,username}",
  });
  if (!data.instagram_business_account) return null;
  return {
    id: data.instagram_business_account.id,
    username: data.instagram_business_account.username ?? "",
  };
}

export type MetaAdAccount = { account_id: string; id: string; name: string };

export async function getAdAccounts(userToken: string): Promise<MetaAdAccount[]> {
  const data = await graphGet<{ data: MetaAdAccount[] }>("/me/adaccounts", {
    access_token: userToken,
    fields: "account_id,name",
  });
  return data.data ?? [];
}
