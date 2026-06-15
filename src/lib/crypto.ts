import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM encryption for secrets at rest (Meta OAuth tokens).
// Key comes from META_TOKEN_KEY (base64-encoded 32 bytes).
// Generate one with: openssl rand -base64 32
//
// Stored format: `${iv}.${authTag}.${ciphertext}` — all base64url.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard nonce length
const KEY_LENGTH = 32; // AES-256

function getKey(): Buffer {
  const raw = process.env.META_TOKEN_KEY;

  if (!raw) {
    throw new Error(
      "Missing META_TOKEN_KEY. Generate one with `openssl rand -base64 32` and set it in .env.local before storing tokens."
    );
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `META_TOKEN_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length}). Use \`openssl rand -base64 32\`.`
    );
  }

  return key;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decrypt(blob: string): string {
  const parts = blob.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted blob format");
  }

  const [ivPart, tagPart, dataPart] = parts;
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(dataPart, "base64url");

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

// True only if a usable key is configured — lets routes fail fast with a clear message.
export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}
