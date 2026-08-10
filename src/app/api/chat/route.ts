import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_PROFILE_ID } from "@/lib/constants";
import { getAIProvider, AIProviderNotConfiguredError } from "@/lib/ai";
import { SupabaseNotConfiguredError } from "@/lib/supabase/client";

const chatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(2000),
});

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(chatTurnSchema).max(40).optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const provider = getAIProvider();
    const result = await provider.converse({
      history: body.history ?? [],
      message: body.message,
      profileId: DEMO_PROFILE_ID,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AIProviderNotConfiguredError) {
      return NextResponse.json(
        { error: "ai_not_configured", missing: error.missingEnvVars },
        { status: 503 },
      );
    }
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "supabase_not_configured", missing: error.missingEnvVars },
        { status: 503 },
      );
    }
    console.error("[POST /api/chat]", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
