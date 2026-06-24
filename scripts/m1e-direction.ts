// Module 1 Phase E — Prompt 1 checks: resolveVisualDirection (PURE, no DB/OpenAI).
// Asserts auto/describe prompt assembly + ratio resolution (AC-4, AC-5).
// Run: npx tsx scripts/m1e-direction.ts   — exits 1 on fail.
import { resolveVisualDirection, resolveRatio } from "@/lib/visual-direction";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

const brand = { visualDna: "BRAND_DNA_MARKER cobalt blue", primaryColor: "#2747DB", secondaryColor: "#FFFFFF", name: "SifuTutor" };

// ── auto mode ──
const auto = resolveVisualDirection({
  visualDirectionText: "ART_DIRECTOR_TEXT: smiling student holding a book, cheerful",
  spec: { platform: "instagram_story" },
  brand,
});
ok("auto → mode auto", auto.mode === "auto");
ok("auto → prompt carries the art_director text", /ART_DIRECTOR_TEXT/.test(auto.imagePrompt));
ok("auto → prompt carries brand visualDna", /BRAND_DNA_MARKER/.test(auto.imagePrompt));
ok("auto → prompt carries brand colours", auto.imagePrompt.includes("#2747DB"));
ok("auto → prompt has the logo-reserve clause", /TOP-LEFT corner/.test(auto.imagePrompt));
ok("auto → story platform resolves 9:16", auto.ratio === "9:16");
ok("auto → ratio sentence matches", /Vertical 9:16/.test(auto.imagePrompt));

// ── describe mode ──
const desc = resolveVisualDirection({
  visualDirectionText: "ART_DIRECTOR_TEXT should be ignored here",
  describeText: "USER_DESCRIBE: masjid at maghrib, warm light",
  useDescribe: true,
  spec: { platform: "feed" },
  brand,
});
ok("describe → mode describe", desc.mode === "describe");
ok("describe → prompt seeded from describeText", /USER_DESCRIBE/.test(desc.imagePrompt));
ok("describe → art_director text NOT used", !/ART_DIRECTOR_TEXT/.test(desc.imagePrompt));
ok("describe → feed platform resolves 1:1", desc.ratio === "1:1");

// describe opt-in required: useDescribe missing → falls back to auto
const noOptIn = resolveVisualDirection({ visualDirectionText: "AD_TEXT", describeText: "ignored", spec: {}, brand });
ok("no useDescribe flag → mode auto", noOptIn.mode === "auto");
ok("no useDescribe → uses art_director text", /AD_TEXT/.test(noOptIn.imagePrompt));

// ── ratio resolution ──
ok("explicit spec.ratio wins", resolveRatio({ ratio: "16:9", platform: "feed" }) === "16:9");
ok("spec.aspect honoured", resolveRatio({ aspect: "1:1" }) === "1:1");
ok("youtube platform → 16:9", resolveRatio({ platform: "YouTube" }) === "16:9");
ok("placement fallback used", resolveRatio({ placement: "reels" }) === "9:16");
ok("empty spec → 9:16 default", resolveRatio({}) === "9:16");
ok("null spec → 9:16 default", resolveRatio(null) === "9:16");
ok("garbage spec → 9:16 default", resolveRatio("nonsense") === "9:16");

// ── never empty ──
const bare = resolveVisualDirection({ visualDirectionText: "", spec: {}, brand });
ok("empty source → still non-empty prompt", bare.imagePrompt.trim().length > 0);
ok("empty source → brand fallback line", new RegExp(brand.name).test(bare.imagePrompt));

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
