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
