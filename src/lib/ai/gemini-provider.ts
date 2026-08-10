import "server-only";
import {
  GoogleGenAI,
  type Chat,
  type Content,
  type FunctionDeclaration,
  type GenerateContentResponse,
  type Part,
  type SendMessageParameters,
} from "@google/genai";
import { z } from "zod";
import { buildSystemPrompt } from "./system-prompt";
import { executeTool, ToolValidationError, TOOLS } from "./tools";
import {
  AIProviderNotConfiguredError,
  AIRateLimitedError,
  AITimeoutError,
  type AIProvider,
  type AIReplyResult,
  type AssistantAction,
  type ChatTurn,
  type ConverseInput,
} from "./provider";

export interface GeminiConfigStatus {
  configured: boolean;
  missing: string[];
}

export function getGeminiConfigStatus(): GeminiConfigStatus {
  const missing: string[] = [];
  if (!process.env.GEMINI_API_KEY) missing.push("GEMINI_API_KEY");
  return { configured: missing.length === 0, missing };
}

// A stable "lite" alias (not a dated model id) so this keeps working as
// Google retires older model versions. Verified working against a real
// free-tier API key - the non-lite "flash-latest" alias hit a much
// stricter shared free-tier quota in testing and stayed 429'd for several
// minutes, while "flash-lite-latest" kept working throughout.
const DEFAULT_MODEL = "gemini-flash-lite-latest";
/**
 * Guards against a runaway tool-call loop. A single message that states
 * several facts at once (balance + income + several expenses, as in the
 * demo script) can legitimately need one round per fact plus a final round
 * for the wrap-up reply - too tight a cap here silently drops the last
 * fact and/or truncates the reply to a generic fallback.
 */
const MAX_TOOL_ITERATIONS = 15;

function buildFunctionDeclarations(): FunctionDeclaration[] {
  return TOOLS.map((tool) => {
    const jsonSchema = z.toJSONSchema(tool.schema, { target: "draft-7" }) as Record<string, unknown>;
    delete jsonSchema.$schema;
    return {
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: jsonSchema,
    } satisfies FunctionDeclaration;
  });
}

function toGeminiHistory(history: ChatTurn[]): Content[] {
  return history.map((turn) => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));
}

const RATE_LIMIT_STATUS = 429;
/**
 * One quick, short retry to absorb a transient blip. A conversational turn
 * that needs several tool-call rounds makes several requests, so retrying
 * each one for the API's *suggested* delay (which can be 30-60s+ on the
 * free tier) compounds across rounds into a multi-minute hang with no
 * upper bound - exactly what produced an indefinite "..." in testing.
 * Failing fast here and reporting the real delay lets the caller decide
 * whether to wait, instead of us silently blocking on their behalf.
 */
const MAX_RATE_LIMIT_RETRIES = 1;
const RETRY_DELAY_MS = 2000;
/**
 * Hard ceiling on an entire conversational turn (every tool-call round
 * included), so the UI always gets a response within a bounded time no
 * matter how many rounds or retries happen underneath. Tool calls already
 * in flight when this fires still complete and persist server-side - we
 * only stop waiting on the model's next message.
 */
const CONVERSE_TIMEOUT_MS = 45_000;

function parseRetryDelaySeconds(message: string): number | undefined {
  const match = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return match ? Number.parseFloat(match[1]) : undefined;
}

/**
 * Gemini's free tier is easy to hit mid-conversation - a single turn that
 * triggers a few tool calls costs a few requests. Retries a rate-limited
 * (429) call once after a short fixed delay, then gives up with a
 * distinct, user-actionable error (carrying the API's suggested wait) so
 * the caller can decide when to retry, rather than a generic 500.
 */
async function sendMessageWithRetry(chat: Chat, params: SendMessageParameters): Promise<GenerateContentResponse> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await chat.sendMessage(params);
    } catch (error) {
      const status = (error as { status?: number } | undefined)?.status;
      const message = error instanceof Error ? error.message : "";
      if (status !== RATE_LIMIT_STATUS) throw error;

      const retryAfterSeconds = parseRetryDelaySeconds(message);
      if (attempt >= MAX_RATE_LIMIT_RETRIES) {
        throw new AIRateLimitedError(retryAfterSeconds);
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AITimeoutError()), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Gemini implementation of the provider-agnostic AIProvider interface.
 * Swapping to another provider means writing a new file that implements
 * `AIProvider` against the same `TOOLS` list - nothing else changes.
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private client: GoogleGenAI;
  private model: string;

  constructor() {
    const status = getGeminiConfigStatus();
    if (!status.configured) {
      throw new AIProviderNotConfiguredError(status.missing);
    }
    this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    this.model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  }

  async converse(input: ConverseInput): Promise<AIReplyResult> {
    return withTimeout(this.converseInner(input), CONVERSE_TIMEOUT_MS);
  }

  private async converseInner(input: ConverseInput): Promise<AIReplyResult> {
    const chat = this.client.chats.create({
      model: this.model,
      history: toGeminiHistory(input.history),
      config: {
        systemInstruction: buildSystemPrompt(),
        tools: [{ functionDeclarations: buildFunctionDeclarations() }],
      },
    });

    const actions: AssistantAction[] = [];
    let requestCount = 0;
    let response = await sendMessageWithRetry(chat, { message: input.message });
    requestCount += 1;

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i += 1) {
      const calls = response.functionCalls;
      if (!calls || calls.length === 0) break;

      const responseParts: Part[] = [];
      for (const call of calls) {
        const name = call.name ?? "";
        try {
          const result = await executeTool(name, call.args ?? {}, { profileId: input.profileId });
          actions.push({ toolName: name, args: call.args ?? {}, message: result.message, data: result.data });
          responseParts.push({ functionResponse: { name, response: { output: result.data } } });
        } catch (error) {
          const message =
            error instanceof ToolValidationError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Tool execution failed";
          responseParts.push({ functionResponse: { name, response: { error: message } } });
        }
      }

      response = await sendMessageWithRetry(chat, { message: responseParts });
      requestCount += 1;
    }

    // Cheap ongoing visibility into how expensive a turn was on a
    // rate-limited free tier - each round here is a real Gemini request.
    console.log(`[GeminiProvider] turn used ${requestCount} Gemini request(s) across ${actions.length} tool call(s)`);

    return { reply: response.text?.trim() || "Done.", actions };
  }
}
