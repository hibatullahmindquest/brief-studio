/**
 * One-time ETL: import historical Meta Ads data from the marketing-ai-agent
 * local Postgres into brief-studio.
 *
 * Source : marketing-ai-agent docker db  (host localhost:5433 via compose override)
 * Dest   : brief-studio Postgres (DATABASE_URL)
 *
 * Maps source brand slug -> brief-studio Brand (must already exist, e.g. nakngaji).
 * Upserts AdCreative per ad, batch-inserts AdDailyMetric per (ad, date).
 * If META_TOKEN_KEY is set, also stores each ad account's token (encrypted)
 * as a MetaConnection so brief-studio can reuse it for ongoing sync.
 *
 * Run:
 *   SOURCE_DB_URL="postgresql://postgres:password@localhost:5433/postgres" \
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/brief_studio" \
 *   npx tsx scripts/import-meta-history.ts
 */
import { Client, types } from "pg";
import { PrismaClient } from "@prisma/client";

// node-postgres parses DATE (OID 1082) into a local-midnight JS Date, which
// shifts the day backwards on UTC+offset machines. Keep it as a raw
// 'YYYY-MM-DD' string and build an explicit UTC date instead.
types.setTypeParser(1082, (v: string) => v);

const SOURCE_DB_URL =
  process.env.SOURCE_DB_URL || "postgresql://postgres:password@localhost:5433/postgres";

const prisma = new PrismaClient();

type SourceRow = {
  slug: string;
  account_id: string;
  account_name: string;
  access_token: string | null;
  ad_id: string;
  ad_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  objective: string | null;
  effective_status: string | null;
  metric_date: string;
  spend: string | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  link_clicks: number | null;
  leads: number | null;
  wa_conversations: number | null;
  ctr_pct: string | null;
  cpc: string | null;
  cpm: string | null;
  cpl: string | null;
  frequency: string | null;
  country: string | null;
  placement: string | null;
  age_range: string | null;
  ad_format: string | null;
  segment: string | null;
};

const num = (v: string | number | null): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const int = (v: number | null): number => (v === null || v === undefined ? 0 : v);

async function maybeEncrypt(token: string | null): Promise<string | null> {
  if (!token) return null;
  if (!process.env.META_TOKEN_KEY) return null;
  const { encrypt } = await import("../src/lib/crypto");
  return encrypt(token);
}

async function main() {
  const args = process.argv.slice(2);
  const onlySlug = args.find((a) => a.startsWith("--slug="))?.split("=")[1];

  const src = new Client({ connectionString: SOURCE_DB_URL });
  await src.connect();

  const where = onlySlug ? "WHERE b.slug = $1" : "";
  const params = onlySlug ? [onlySlug] : [];
  const { rows } = await src.query<SourceRow>(
    `SELECT b.slug, a.account_id, a.account_name, a.access_token,
            m.ad_id, m.ad_name, m.campaign_id, m.campaign_name, m.adset_name,
            m.objective, m.effective_status, m.metric_date,
            m.spend, m.impressions, m.reach, m.clicks, m.link_clicks,
            m.leads, m.wa_conversations, m.ctr_pct, m.cpc, m.cpm, m.cpl, m.frequency,
            m.country, m.placement, m.age_range, m.ad_format, m.segment
       FROM ad_daily_metrics m
       JOIN ad_accounts a ON a.id = m.ad_account_id
       JOIN brands b ON b.id = a.brand_id
       ${where}
       ORDER BY b.slug, m.ad_id, m.metric_date`,
    params
  );
  await src.end();

  console.log(`Source rows: ${rows.length}`);
  if (rows.length === 0) {
    console.log("Nothing to import.");
    return;
  }

  // Resolve brief-studio brands by slug.
  const slugs = [...new Set(rows.map((r) => r.slug))];
  const brands = await prisma.brand.findMany({ where: { slug: { in: slugs } } });
  const brandBySlug = new Map(brands.map((b) => [b.slug, b]));
  for (const s of slugs) {
    if (!brandBySlug.has(s)) {
      console.warn(`! No brief-studio Brand for slug "${s}" — its rows are skipped. Seed it first.`);
    }
  }

  // 1) Token reuse → MetaConnection (ad_account) per source account.
  const accounts = new Map<string, SourceRow>();
  for (const r of rows) if (!accounts.has(r.account_id)) accounts.set(r.account_id, r);

  let connCount = 0;
  for (const r of accounts.values()) {
    const brand = brandBySlug.get(r.slug);
    if (!brand) continue;
    const tokenEnc = await maybeEncrypt(r.access_token);
    await prisma.metaConnection.upsert({
      where: { brandId_type_externalId: { brandId: brand.id, type: "ad_account", externalId: r.account_id } },
      create: {
        brandId: brand.id,
        type: "ad_account",
        externalId: r.account_id,
        name: r.account_name,
        tokenEnc,
        status: tokenEnc ? "connected" : "needs_reauth",
        scopes: "ads_read",
      },
      update: { name: r.account_name, ...(tokenEnc ? { tokenEnc, status: "connected" } : {}) },
    });
    connCount++;
  }
  console.log(`MetaConnections upserted: ${connCount}${process.env.META_TOKEN_KEY ? "" : " (no META_TOKEN_KEY → tokens NOT stored)"}`);

  // 2) AdCreatives — one per (brand, ad_id), latest name/campaign wins.
  const adKey = (slug: string, adId: string) => `${slug}::${adId}`;
  const latestAd = new Map<string, SourceRow>();
  for (const r of rows) latestAd.set(adKey(r.slug, r.ad_id), r); // ordered, last = latest date

  const adIdMap = new Map<string, string>(); // adKey -> brief-studio AdCreative.id
  let adCount = 0;
  for (const [k, r] of latestAd) {
    const brand = brandBySlug.get(r.slug);
    if (!brand) continue;
    const creative = await prisma.adCreative.upsert({
      where: { brandId_metaAdId: { brandId: brand.id, metaAdId: r.ad_id } },
      create: {
        brandId: brand.id,
        metaAdId: r.ad_id,
        campaignId: r.campaign_id ?? "",
        name: r.ad_name ?? "",
      },
      update: { campaignId: r.campaign_id ?? "", name: r.ad_name ?? "" },
      select: { id: true },
    });
    adIdMap.set(k, creative.id);
    adCount++;
  }
  console.log(`AdCreatives upserted: ${adCount}`);

  // 3) AdDailyMetric — batch insert, skip duplicates (idempotent re-runs).
  const data = rows
    .map((r) => {
      const brand = brandBySlug.get(r.slug);
      const adId = adIdMap.get(adKey(r.slug, r.ad_id));
      if (!brand || !adId) return null;
      const breakdowns: Record<string, string> = {};
      for (const [key, val] of Object.entries({
        country: r.country,
        placement: r.placement,
        age_range: r.age_range,
        ad_format: r.ad_format,
        segment: r.segment,
      })) {
        if (val) breakdowns[key] = val;
      }
      return {
        adId,
        brandId: brand.id,
        metricDate: new Date(`${r.metric_date}T00:00:00.000Z`),
        spend: num(r.spend),
        impressions: int(r.impressions),
        reach: int(r.reach),
        clicks: int(r.clicks),
        linkClicks: int(r.link_clicks),
        leads: int(r.leads),
        waConversations: int(r.wa_conversations),
        ctr: num(r.ctr_pct),
        cpc: num(r.cpc),
        cpm: num(r.cpm),
        cpl: num(r.cpl),
        frequency: num(r.frequency),
        campaignId: r.campaign_id ?? "",
        campaignName: r.campaign_name ?? "",
        adsetName: r.adset_name ?? "",
        objective: r.objective ?? "",
        effectiveStatus: r.effective_status ?? "",
        metricsJson: Object.keys(breakdowns).length ? JSON.stringify(breakdowns) : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const BATCH = 1000;
  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH) {
    const chunk = data.slice(i, i + BATCH);
    const res = await prisma.adDailyMetric.createMany({ data: chunk, skipDuplicates: true });
    inserted += res.count;
    console.log(`  ...${Math.min(i + BATCH, data.length)}/${data.length} (inserted ${inserted})`);
  }
  console.log(`AdDailyMetric inserted: ${inserted} (duplicates skipped)`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
