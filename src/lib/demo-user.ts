import { createHash } from "crypto";

export type DemoUser = {
  id: string;
  email: string;
  name: string;
  username: string;
};

type BuildDemoUserInput = {
  email: string;
  name?: string | null;
  username?: string | null;
};

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeUsername(value: string) {
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 24);
  return clean || "demo-user";
}

function toDeterministicId(email: string) {
  return `demo_${createHash("sha256").update(email).digest("hex").slice(0, 24)}`;
}

export function buildDemoUser(input: BuildDemoUserInput): DemoUser {
  const normalizedEmail = input.email.trim().toLowerCase();
  const localPart = normalizedEmail.split("@")[0] || "demo-user";
  const username = normalizeUsername(input.username ?? localPart);
  const inferredName = titleCase(localPart.replace(/[._-]+/g, " "));
  const name = (input.name?.trim() || inferredName || "Demo User").slice(0, 80);

  return {
    id: toDeterministicId(normalizedEmail),
    email: normalizedEmail,
    name,
    username,
  };
}
