#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function parseEnvFile(content) {
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function loadEnvFromFiles(cwd) {
  const env = { ...process.env };
  const envFiles = [".env", ".env.local"];

  for (const fileName of envFiles) {
    const fullPath = path.join(cwd, fileName);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    const parsed = parseEnvFile(content);

    for (const [key, value] of Object.entries(parsed)) {
      env[key] = value;
    }
  }

  return env;
}

function printList(title, items) {
  console.log(`\n${title}`);
  for (const item of items) {
    console.log(`- ${item}`);
  }
}

const env = loadEnvFromFiles(process.cwd());

const required = ["DATABASE_URL", "SESSION_SECRET"];
const optionalGroups = {
  "AI features": ["OPENAI_API_KEY"],
  "Stripe checkout": [
    "STRIPE_SECRET_KEY",
    "STRIPE_PRICE_STARTER",
    "STRIPE_PRICE_PRO",
    "STRIPE_PRICE_BUSINESS",
  ],
  "Instagram scraping": ["APIFY_TOKEN"],
};

const missingRequired = required.filter((key) => !env[key]);

if (!missingRequired.length) {
  const sessionSecret = env.SESSION_SECRET ?? "";
  if (sessionSecret.length < 32) {
    missingRequired.push("SESSION_SECRET (must be 32+ characters)");
  }
}

if (missingRequired.length) {
  printList("Missing required environment variables:", missingRequired);
  console.log("\nCreate .env.local from .env.example and try again.");
  process.exit(1);
}

console.log("Required environment variables look good.");

for (const [group, keys] of Object.entries(optionalGroups)) {
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) {
    printList(`Optional variables missing for ${group}:`, missing);
  }
}

console.log("\nEnvironment check complete.");
