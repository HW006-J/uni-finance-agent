import { NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";
import { getGeminiConfigStatus, buildFunctionDeclarations } from "@/lib/ai/gemini-provider";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";

// A stable alias, verified to exist against a real API key (as of writing).
const DEFAULT_LIVE_MODEL = "gemini-2.5-flash-native-audio-latest";

/**
 * Mints a short-lived ephemeral Gemini token so the browser can open a
 * Gemini Live voice session DIRECTLY (lowest latency for audio), without
 * ever seeing the real GEMINI_API_KEY. The token is locked to our model,
 * system prompt and tool list server-side via `liveConnectConstraints`, so
 * the browser cannot redefine what the assistant can do - it can only use
 * this token to start a session matching our configuration. Tool calls the
 * model makes during that session are still executed server-side, via
 * /api/tools/execute.
 */
export async function POST() {
  const status = getGeminiConfigStatus();
  if (!status.configured) {
    return NextResponse.json({ error: "ai_not_configured", missing: status.missing }, { status: 503 });
  }

  const model = process.env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { apiVersion: "v1alpha" } });

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 5 * 60_000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
        liveConnectConstraints: {
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: buildSystemPrompt(),
            tools: [{ functionDeclarations: buildFunctionDeclarations() }],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        },
      },
    });

    return NextResponse.json({ token: token.name, model });
  } catch (error) {
    console.error("[POST /api/voice/token]", error);
    return NextResponse.json({ error: "voice_unavailable" }, { status: 502 });
  }
}
