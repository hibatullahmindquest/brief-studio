import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, isEncryptionConfigured } from "@/lib/crypto";
import { logError } from "@/lib/error-log";
import {
  exchangeCode,
  exchangeLongLived,
  getAdAccounts,
  getIgAccount,
  getPages,
  META_SCOPES,
  verifyState,
} from "@/lib/meta";

// GET /api/meta/callback — Meta redirects here after the user authorises.
// Exchanges the code, fetches Page + IG + ad accounts, and stores encrypted
// connections. Tokens are never returned to the client.
function settingsRedirect(req: NextRequest, status: string) {
  const url = new URL("/dashboard/settings/meta", req.nextUrl.origin);
  url.searchParams.set("meta", status);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // User denied or Meta returned an error.
  if (params.get("error")) {
    return settingsRedirect(req, "denied");
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return settingsRedirect(req, "invalid");
  }

  const verified = verifyState(state);
  if (!verified) {
    return settingsRedirect(req, "expired");
  }

  if (!isEncryptionConfigured()) {
    return settingsRedirect(req, "no_key");
  }

  const { brandId } = verified;
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } });
  if (!brand) {
    return settingsRedirect(req, "invalid");
  }

  try {
    const shortToken = await exchangeCode(code);
    const { token: longToken, expiresIn } = await exchangeLongLived(shortToken);
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000);
    const scopes = META_SCOPES.join(",");

    const pages = await getPages(longToken);
    // v1: use the first page. Multi-page selection is a fast-follow.
    const page = pages[0];

    if (page) {
      await prisma.metaConnection.upsert({
        where: { brandId_type_externalId: { brandId, type: "page", externalId: page.id } },
        create: {
          brandId,
          type: "page",
          externalId: page.id,
          name: page.name,
          tokenEnc: encrypt(page.access_token),
          tokenExpiry,
          scopes,
          status: "connected",
        },
        update: {
          name: page.name,
          tokenEnc: encrypt(page.access_token),
          tokenExpiry,
          scopes,
          status: "connected",
          lastError: null,
        },
      });

      // Instagram business account linked to the page (may be absent).
      const ig = await getIgAccount(page.id, page.access_token);
      if (ig) {
        await prisma.metaConnection.upsert({
          where: { brandId_type_externalId: { brandId, type: "instagram", externalId: ig.id } },
          create: {
            brandId,
            type: "instagram",
            externalId: ig.id,
            name: ig.username,
            tokenEnc: encrypt(page.access_token),
            tokenExpiry,
            scopes,
            status: "connected",
          },
          update: {
            name: ig.username,
            tokenEnc: encrypt(page.access_token),
            tokenExpiry,
            scopes,
            status: "connected",
            lastError: null,
          },
        });
      }
    }

    // Ad accounts (may be empty) — use the long-lived user token.
    const adAccounts = await getAdAccounts(longToken);
    for (const acct of adAccounts) {
      const externalId = `act_${acct.account_id}`;
      await prisma.metaConnection.upsert({
        where: { brandId_type_externalId: { brandId, type: "ad_account", externalId } },
        create: {
          brandId,
          type: "ad_account",
          externalId,
          name: acct.name,
          tokenEnc: encrypt(longToken),
          tokenExpiry,
          scopes,
          status: "connected",
        },
        update: {
          name: acct.name,
          tokenEnc: encrypt(longToken),
          tokenExpiry,
          scopes,
          status: "connected",
          lastError: null,
        },
      });
    }

    return settingsRedirect(req, "connected");
  } catch (e) {
    // Graph error — surface a generic status, never the token or raw error to the client URL.
    await logError({ source: "meta.callback", error: e, brandId, context: { stage: "oauth_exchange" } });
    return settingsRedirect(req, "error");
  }
}
