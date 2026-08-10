import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const repoMocks = vi.hoisted(() => ({
  getFinancialState: vi.fn(),
  getProfileCurrency: vi.fn().mockResolvedValue("GBP"),
  setCurrentBalance: vi.fn(),
  setEmergencyBuffer: vi.fn(),
  addOrUpdateIncome: vi.fn(),
  addOrUpdateExpense: vi.fn(),
  logTransaction: vi.fn(),
  createOrUpdateGoal: vi.fn(),
}));
vi.mock("@/lib/supabase/repository", () => repoMocks);

const sendMessageMock = vi.hoisted(() => vi.fn());
const chatsCreateMock = vi.hoisted(() => vi.fn(() => ({ sendMessage: sendMessageMock })));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    chats = { create: chatsCreateMock };
  },
}));

import { GeminiProvider, getGeminiConfigStatus } from "./gemini-provider";
import { AIProviderNotConfiguredError, AIRateLimitedError } from "./provider";
import { makeProfile } from "@/lib/finance/test-helpers";

function rateLimitError(retryDelaySeconds = 0.01): Error & { status: number } {
  const err = new Error(
    `{"error":{"code":429,"message":"quota exceeded","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"${retryDelaySeconds}s"}]}}`,
  ) as Error & { status: number };
  err.status = 429;
  return err;
}

describe("GeminiProvider", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
  });

  it("reports itself unconfigured without throwing when GEMINI_API_KEY is missing", () => {
    delete process.env.GEMINI_API_KEY;
    expect(getGeminiConfigStatus()).toEqual({ configured: false, missing: ["GEMINI_API_KEY"] });
  });

  it("throws AIProviderNotConfiguredError on construction when GEMINI_API_KEY is missing", () => {
    delete process.env.GEMINI_API_KEY;
    expect(() => new GeminiProvider()).toThrow(AIProviderNotConfiguredError);
  });

  it("executes a tool call the model requests, feeds the result back, and returns the model's final reply", async () => {
    repoMocks.logTransaction.mockResolvedValue({
      transaction: {
        id: "t1",
        profileId: "p1",
        merchant: "Tesco",
        amount: 42,
        category: "groceries",
        date: "2026-01-01T00:00:00.000Z",
        notes: null,
        source: "chat",
      },
      profile: makeProfile({ currentBalance: 958 }),
    });

    sendMessageMock
      .mockResolvedValueOnce({
        functionCalls: [{ name: "log_transaction", args: { merchant: "Tesco", amount: 42, category: "groceries" } }],
        text: undefined,
      })
      .mockResolvedValueOnce({ functionCalls: undefined, text: "Logged your £42 Tesco shop." });

    const provider = new GeminiProvider();
    const result = await provider.converse({ history: [], message: "I spent £42 at Tesco", profileId: "p1" });

    expect(repoMocks.logTransaction).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(result.reply).toBe("Logged your £42 Tesco shop.");
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].toolName).toBe("log_transaction");
    expect(result.actions[0].message).toContain("Tesco");
  });

  it("feeds a validation failure back to the model as an error instead of throwing", async () => {
    sendMessageMock
      .mockResolvedValueOnce({
        functionCalls: [{ name: "set_current_balance", args: { amount: -10 } }],
        text: undefined,
      })
      .mockResolvedValueOnce({ functionCalls: undefined, text: "Sorry, I couldn't set that balance." });

    const provider = new GeminiProvider();
    const result = await provider.converse({ history: [], message: "set my balance to -10", profileId: "p1" });

    expect(repoMocks.setCurrentBalance).not.toHaveBeenCalled();
    expect(result.actions).toHaveLength(0);
    expect(result.reply).toBe("Sorry, I couldn't set that balance.");

    const secondCallArgs = sendMessageMock.mock.calls[1][0];
    expect(secondCallArgs.message[0].functionResponse.response.error).toBeTruthy();
  });

  it("retries once on a rate-limited (429) response, honoring the API's suggested delay, and succeeds", async () => {
    sendMessageMock.mockRejectedValueOnce(rateLimitError()).mockResolvedValueOnce({ functionCalls: undefined, text: "Hi there!" });

    const provider = new GeminiProvider();
    const result = await provider.converse({ history: [], message: "hi", profileId: "p1" });

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(result.reply).toBe("Hi there!");
  });

  it("gives up after repeated rate limiting and throws a distinct, actionable error", async () => {
    sendMessageMock.mockRejectedValue(rateLimitError());

    const provider = new GeminiProvider();
    await expect(provider.converse({ history: [], message: "hi", profileId: "p1" })).rejects.toBeInstanceOf(AIRateLimitedError);
  });

  it("stops replying with a fallback when the model never produces text", async () => {
    sendMessageMock.mockResolvedValueOnce({ functionCalls: undefined, text: undefined });

    const provider = new GeminiProvider();
    const result = await provider.converse({ history: [], message: "hi", profileId: "p1" });

    expect(result.reply).toBe("Done.");
    expect(result.actions).toHaveLength(0);
  });
});
