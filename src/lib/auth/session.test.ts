import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, getDemoAuthConfigStatus, verifyPassword, verifySessionToken } from "./session";

describe("getDemoAuthConfigStatus / verifyPassword", () => {
  const original = process.env.DEMO_PASSWORD;

  afterEach(() => {
    process.env.DEMO_PASSWORD = original;
  });

  it("reports unconfigured when DEMO_PASSWORD is unset", () => {
    delete process.env.DEMO_PASSWORD;
    expect(getDemoAuthConfigStatus()).toEqual({ configured: false, missing: ["DEMO_PASSWORD"] });
    expect(verifyPassword("anything")).toBe(false);
  });

  it("accepts the exact configured password and rejects everything else", () => {
    process.env.DEMO_PASSWORD = "correct-horse-battery-staple";
    expect(getDemoAuthConfigStatus()).toEqual({ configured: true, missing: [] });
    expect(verifyPassword("correct-horse-battery-staple")).toBe(true);
    expect(verifyPassword("wrong")).toBe(false);
    expect(verifyPassword("correct-horse-battery-staplex")).toBe(false);
    expect(verifyPassword("")).toBe(false);
  });
});

describe("createSessionToken / verifySessionToken", () => {
  const original = process.env.DEMO_PASSWORD;

  beforeEach(() => {
    process.env.DEMO_PASSWORD = "test-demo-password";
  });

  afterEach(() => {
    process.env.DEMO_PASSWORD = original;
  });

  it("issues a token that verifies successfully against the same password", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("rejects a missing or malformed token", async () => {
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken(null)).toBe(false);
    expect(await verifySessionToken("")).toBe(false);
    expect(await verifySessionToken("not-a-real-token")).toBe(false);
  });

  it("rejects a token that was signed with a different password", async () => {
    const token = await createSessionToken();
    process.env.DEMO_PASSWORD = "a-different-password";
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const expiredPayload = String(Date.now() - 1000);
    expect(await verifySessionToken(`${expiredPayload}.fakesignature`)).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const token = await createSessionToken();
    const [payload] = token.split(".");
    expect(await verifySessionToken(`${payload}.not-the-real-signature`)).toBe(false);
  });

  it("never verifies when DEMO_PASSWORD is unset, even for a token issued earlier", async () => {
    const token = await createSessionToken();
    delete process.env.DEMO_PASSWORD;
    expect(await verifySessionToken(token)).toBe(false);
  });
});
