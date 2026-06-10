import { generateCopy } from "../src/lib/openai";

async function main() {
  const result = await generateCopy("SifuTutor", "Bold", "Tutor matching platform", "Instagram Post", 1);
  console.log("RESULT:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
