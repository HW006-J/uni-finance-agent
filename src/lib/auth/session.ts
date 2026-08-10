/**
 * Lightweight access gate for the hackathon demo - NOT a user account
 * system. There is exactly one shared demo financial profile (see
 * DEMO_PROFILE_ID); everyone who knows the demo password sees the same
 * data. This module only decides "does this visitor know the password",
 * nothing more.
 *
 * Deliberately dependency-free and Web Crypto only (no Node built-ins) so
 * it works unchanged in both the Node.js route handlers and the Edge
 * runtime that Next.js Middleware runs on by default (including on
 * Vercel).
 */

export const SESSION_COOKIE_NAME = "demo_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

export interface DemoAuthConfigStatus {
  configured: boolean;
  missing: string[];
}

export function getDemoAuthConfigStatus(): DemoAuthConfigStatus {
  const missing: string[] = [];
  if (!process.env.DEMO_PASSWORD) missing.push("DEMO_PASSWORD");
  return { configured: missing.length === 0, missing };
}

function toBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/** Signs a fresh session token bound to DEMO_PASSWORD, valid for SESSION_TTL_MS. */
export async function createSessionToken(): Promise<string> {
  const secret = process.env.DEMO_PASSWORD;
  if (!secret) throw new Error("DEMO_PASSWORD is not configured");
  const payload = String(Date.now() + SESSION_TTL_MS);
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${toBase64Url(signature)}`;
}

/** Verifies a session token's signature and expiry. Always false if DEMO_PASSWORD isn't set. */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.DEMO_PASSWORD;
  if (!secret) return false;

  const [payload, signaturePart] = token.split(".");
  if (!payload || !signaturePart) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  try {
    const key = await getHmacKey(secret);
    const signatureBytes = fromBase64Url(signaturePart);
    return await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}

/** Constant-time-ish comparison against DEMO_PASSWORD. Always false if it isn't set. */
export function verifyPassword(candidate: string): boolean {
  const secret = process.env.DEMO_PASSWORD;
  if (!secret) return false;
  if (candidate.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i += 1) {
    diff |= candidate.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}
