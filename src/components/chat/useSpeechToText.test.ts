import { describe, expect, it } from "vitest";
import { describeError, isSpeechRecognitionSupported } from "./useSpeechToText";

describe("isSpeechRecognitionSupported", () => {
  it("reports unsupported outside a browser (no window)", () => {
    expect(isSpeechRecognitionSupported()).toBe(false);
  });
});

describe("describeError", () => {
  it("gives a clear, actionable message for a denied microphone permission", () => {
    expect(describeError("not-allowed")).toMatch(/permission denied/i);
    expect(describeError("service-not-allowed")).toMatch(/permission denied/i);
  });

  it("gives a clear message for no speech detected", () => {
    expect(describeError("no-speech")).toMatch(/didn't catch/i);
  });

  it("gives a clear message when no microphone is available", () => {
    expect(describeError("audio-capture")).toMatch(/no microphone/i);
  });

  it("suppresses a message for a user-initiated abort (not a real error)", () => {
    expect(describeError("aborted")).toBe("");
  });

  it("falls back to a generic retry message for unknown error codes", () => {
    expect(describeError("some-new-unmapped-code")).toMatch(/try again or use text/i);
  });
});
