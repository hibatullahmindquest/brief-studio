import OpenAI from "openai";
import type { BrandContext } from "@/lib/brand-context";

export type GeneratedCopy = {
  primaryPost: string;
  caption: string;
  callToAction: string;
  hashtags: string[];
  strategyNote: string;
};

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("Missing OpenAI API key");
  }
  return new OpenAI({ apiKey: key });
}

function mockResponse(brandName: string, tone: string, product: string, contentType: string): GeneratedCopy {
  const toneEmoji: Record<string, string> = { Bold: "🔥", Luxury: "✨", Hype: "🚀" };
  const emoji = toneEmoji[tone] ?? "🚀";
  return {
    primaryPost: `${emoji} Introducing the ${product} from ${brandName}. This isn't just another drop — this is the one you've been waiting for. Limited quantity. Zero compromises.`,
    caption: `The ${product} represents everything ${brandName} stands for. Crafted for those who move different. Are you ready?`,
    callToAction: `Shop now before it's gone → link in bio. Drop ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`,
    hashtags: [
      brandName.replace(/\s+/g, "").toLowerCase(),
      product.split(" ")[0].toLowerCase(),
      contentType.replace(/\s+/g, "").toLowerCase(),
      tone.toLowerCase(),
      "newdrop",
      "limitededition",
      "streetwear",
      "hypebeast",
    ],
    strategyNote: `Post during peak engagement (6–9 PM local). Use the ${tone.toLowerCase()} tone across all visuals. Pair with a Reel or carousel for 3× reach. Repurpose caption as a Story poll to drive interaction.`,
  };
}

const BASE_SYSTEM_PROMPT = `You are a world-class social media copywriter specialising in Malaysian education brands. When asked to generate content, always respond with ONLY valid JSON matching this exact shape (no markdown, no extra keys):
{
  "primaryPost": "<main social media post text>",
  "caption": "<secondary caption angle, 1-2 sentences>",
  "callToAction": "<single strong CTA line>",
  "hashtags": ["<tag1>", "<tag2>", "..."],
  "strategyNote": "<1-2 sentence posting strategy tip>"
}
Hashtags should be plain words without the # symbol. Return 8-12 hashtags.`;

export async function generateCopy(
  brand: BrandContext,
  product: string,
  contentType: string,
  variant: number,
  briefAnswers?: Record<string, string>
): Promise<GeneratedCopy> {
  const client = getClient();
  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n## Brand Guidelines\n${brand.promptBlock}`;
  const briefBlock = briefAnswers
    ? "\n\nBrief dari user:\n" +
      Object.entries(briefAnswers)
        .filter(([, v]) => v && v !== "—")
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")
    : "";
  const userPrompt = `Create a ${contentType} about "${product}" for the ${brand.name} brand. Variant ${variant}. Hook the audience immediately. Follow the brand guidelines strictly.${briefBlock}`;
  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 5000,
      response_format: { type: "json_object" },
    });
    const raw = response.choices[0]?.message?.content?.trim() || "{}";
    const parsed = JSON.parse(raw) as Partial<GeneratedCopy>;
    return {
      primaryPost: parsed.primaryPost ?? "",
      caption: parsed.caption ?? "",
      callToAction: parsed.callToAction ?? "",
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      strategyNote: parsed.strategyNote ?? "",
    };
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code: string }).code
        : null;
    if (code === "insufficient_quota") {
      console.warn("[openai] quota exceeded — returning mock response");
      return mockResponse(brand.name, brand.tone, product, contentType);
    }
    throw err;
  }
}
