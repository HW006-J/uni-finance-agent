import { describe, expect, it } from "vitest";
import { arrayBufferToBase64, base64ToArrayBuffer, downsample, floatTo16BitPCM, int16PCMToFloat } from "./pcm";

describe("PCM16 helpers", () => {
  it("round-trips float samples through 16-bit PCM within quantization error", () => {
    const input = new Float32Array([0, 0.5, -0.5, 1, -1, 0.25]);
    const pcm = floatTo16BitPCM(input);
    const output = int16PCMToFloat(pcm);
    for (let i = 0; i < input.length; i += 1) {
      expect(output[i]).toBeCloseTo(input[i], 3);
    }
  });

  it("round-trips an ArrayBuffer through base64", () => {
    const original = new Uint8Array([0, 1, 2, 253, 254, 255, 128, 64]);
    const base64 = arrayBufferToBase64(original.buffer);
    const roundTripped = new Uint8Array(base64ToArrayBuffer(base64));
    expect(Array.from(roundTripped)).toEqual(Array.from(original));
  });

  it("downsamples 48kHz to 16kHz by roughly a third of the sample count", () => {
    const input = new Float32Array(4800).fill(0.5);
    const result = downsample(input, 48_000, 16_000);
    expect(result.length).toBe(1600);
    expect(result[0]).toBeCloseTo(0.5, 5);
  });

  it("returns the same buffer when rates already match", () => {
    const input = new Float32Array([0.1, 0.2, 0.3]);
    expect(downsample(input, 16_000, 16_000)).toBe(input);
  });
});
