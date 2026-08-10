import "server-only";
import { GeminiProvider } from "./gemini-provider";
import type { AIProvider } from "./provider";

export { AIProviderNotConfiguredError, AIRateLimitedError, AITimeoutError } from "./provider";
export type { AIProvider, AIReplyResult, AssistantAction, ChatTurn, ConverseInput } from "./provider";
export { getGeminiConfigStatus } from "./gemini-provider";

let cachedProvider: AIProvider | null = null;

/**
 * Single swap point: this is the only place the app decides which AI
 * provider implementation to use. Everything else depends on `AIProvider`.
 */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    cachedProvider = new GeminiProvider();
  }
  return cachedProvider;
}
