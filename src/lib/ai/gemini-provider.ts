import "server-only";
import { GoogleGenAI, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import { z } from "zod";
import { SYSTEM_PROMPT } from "./system-prompt";
import { executeTool, ToolValidationError, TOOLS } from "./tools";
import { AIProviderNotConfiguredError, type AIProvider, type AIReplyResult, type AssistantAction, type ChatTurn, type ConverseInput } from "./provider";

export interface GeminiConfigStatus {
  configured: boolean;
  missing: string[];
}

export function getGeminiConfigStatus(): GeminiConfigStatus {
  const missing: string[] = [];
  if (!process.env.GEMINI_API_KEY) missing.push("GEMINI_API_KEY");
  return { configured: missing.length === 0, missing };
}

const DEFAULT_MODEL = "gemini-2.5-flash";
/** Guards against a runaway tool-call loop; a real conversation needs a handful at most. */
const MAX_TOOL_ITERATIONS = 6;

/** Shared by the text provider and the voice ephemeral-token route so both surfaces expose the same tools. */
export function buildFunctionDeclarations(): FunctionDeclaration[] {
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
    const chat = this.client.chats.create({
      model: this.model,
      history: toGeminiHistory(input.history),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: buildFunctionDeclarations() }],
      },
    });

    const actions: AssistantAction[] = [];
    let response = await chat.sendMessage({ message: input.message });

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

      response = await chat.sendMessage({ message: responseParts });
    }

    return { reply: response.text?.trim() || "Done.", actions };
  }
}
