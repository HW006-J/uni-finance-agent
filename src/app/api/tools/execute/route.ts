import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_PROFILE_ID } from "@/lib/constants";
import { executeTool, ToolValidationError } from "@/lib/ai/tools";
import { SupabaseNotConfiguredError } from "@/lib/supabase/client";

const bodySchema = z.object({
  name: z.string().min(1),
  args: z.unknown(),
});

/**
 * Thin, validated bridge that lets a browser-side Gemini Live voice session
 * execute the SAME tool layer the text chat uses. The Live session itself
 * runs directly between the browser and Gemini (see /api/voice/token) for
 * low latency audio, but it never touches Supabase directly - when Gemini
 * asks the browser to run a tool, the browser calls this route, which runs
 * `executeTool` server-side with the service-role key, exactly like
 * /api/chat does for text. Always responds 200 with a status field so the
 * caller can build a Live `functionResponse` either way.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ status: "error", error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await executeTool(body.name, body.args, { profileId: DEMO_PROFILE_ID });
    return NextResponse.json({ status: "ok", message: result.message, data: result.data });
  } catch (error) {
    if (error instanceof ToolValidationError) {
      return NextResponse.json({ status: "error", error: error.message });
    }
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ status: "error", error: "Database is not configured." });
    }
    console.error("[POST /api/tools/execute]", error);
    return NextResponse.json({ status: "error", error: "Tool execution failed." });
  }
}
