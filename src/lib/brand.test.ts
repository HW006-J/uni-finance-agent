import { describe, expect, it } from "vitest";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "./brand";

describe("brand", () => {
  it("renamed the user-facing product to Runway", () => {
    expect(PRODUCT_NAME).toBe("Runway");
  });

  it("uses a runway-framed tagline, not the old generic one", () => {
    expect(PRODUCT_TAGLINE.toLowerCase()).not.toContain("normal person");
    expect(PRODUCT_TAGLINE.toLowerCase()).toMatch(/money|last/);
  });
});
