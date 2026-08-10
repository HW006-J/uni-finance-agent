/**
 * Provider-agnostic AI boundary.
 *
 * Nothing outside `gemini-provider.ts` (and its future siblings) knows
 * anything about Gemini. The chat API route, the dashboard and the tool
 * layer only ever talk to this `AIProvider` interface, so swapping in
 * GPT/Claude later means writing one new file, not touching the database,
 * the financial engine, the tool definitions, or the UI.
 */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantAction {
  toolName: string;
  args: Record<string, unknown>;
  /** Short action-feed message, e.g. "✓ £43 Tesco added". */
  message: string;
  data: Record<string, unknown>;
}

export interface AIReplyResult {
  reply: string;
  actions: AssistantAction[];
}

export interface ConverseInput {
  history: ChatTurn[];
  message: string;
  profileId: string;
}

export interface AIProvider {
  readonly name: string;
  converse(input: ConverseInput): Promise<AIReplyResult>;
}

export class AIProviderNotConfiguredError extends Error {
  constructor(public missingEnvVars: string[]) {
    super(`AI provider is not configured. Missing environment variable(s): ${missingEnvVars.join(", ")}`);
    this.name = "AIProviderNotConfiguredError";
  }
}

/**
 * Thrown when the provider's API rejects a request for being over its rate
 * limit (very plausible on Gemini's free tier - a single conversational
 * turn can cost several requests when it involves tool calls). Kept
 * distinct from a generic failure so callers can show something
 * actionable ("try again in a few seconds") instead of a bare 500.
 */
export class AIRateLimitedError extends Error {
  constructor(public retryAfterSeconds?: number) {
    super("The AI provider is rate-limiting requests right now.");
    this.name = "AIRateLimitedError";
  }
}

/**
 * Thrown when a conversational turn takes longer than our own wall-clock
 * budget to complete - a message that needs several tool-call rounds can
 * otherwise chain rate-limit waits into a multi-minute hang with no upper
 * bound. This gives the UI a guaranteed point to stop waiting and show a
 * clear error instead of sitting on a loading indicator indefinitely.
 */
export class AITimeoutError extends Error {
  constructor() {
    super("The AI provider took too long to respond.");
    this.name = "AITimeoutError";
  }
}
