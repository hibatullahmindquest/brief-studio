import { generateCopy } from "../src/lib/openai";
import type { BrandContext } from "../src/lib/brand-context";

const mockBrand: BrandContext = {
  id: "test",
  name: "SifuTutor",
  slug: "sifututor",
  tone: "professional, warm, encouraging",
  primaryColor: "#0b1c73",
  secondaryColor: "#ef5122",
  promptBlock: [
    'Brand: SifuTutor',
    'Tagline: "Trusted Home & Online Tutors Across Malaysia"',
    "Tone: professional, warm, encouraging",
    "Target audience: Ibu bapa, pelajar PT3 (13-15), pelajar SPM (15-17)",
    "Core offer: Platform cari tutor 1-to-1 online + home tutor",
    "Key messages: Tutor berpengalaman, belajar di mana-mana, fleksibel",
    "Do NOT say or imply: free trial, free class, nama competitor, confirm gred A",
  ].join("\n"),
  visualDna: "SifuTutor visual style (test stub).",
};

async function main() {
  const result = await generateCopy(mockBrand, "Tutor matching platform", "Instagram Post", 1);
  console.log("RESULT:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
