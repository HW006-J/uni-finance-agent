import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeSupabaseUrl } from "./client";

describe("normalizeSupabaseUrl", () => {
  it("passes a bare project URL through unchanged", () => {
    expect(normalizeSupabaseUrl("https://abcxyz.supabase.co")).toBe("https://abcxyz.supabase.co");
  });

  it("strips an accidentally-pasted /rest/v1 REST API URL suffix", () => {
    expect(normalizeSupabaseUrl("https://abcxyz.supabase.co/rest/v1")).toBe("https://abcxyz.supabase.co");
    expect(normalizeSupabaseUrl("https://abcxyz.supabase.co/rest/v1/")).toBe("https://abcxyz.supabase.co");
  });

  it("strips trailing slashes and surrounding whitespace", () => {
    expect(normalizeSupabaseUrl("  https://abcxyz.supabase.co/  ")).toBe("https://abcxyz.supabase.co");
  });
});
