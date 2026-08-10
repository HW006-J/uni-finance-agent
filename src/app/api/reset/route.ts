import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_PROFILE_ID } from "@/lib/constants";
import { resetDemoProfile } from "@/lib/supabase/repository";
import { SupabaseNotConfiguredError } from "@/lib/supabase/client";

const bodySchema = z.object({ confirm: z.literal(true) });

/**
 * Developer/demo-only reset: clears the single demo profile's stored
 * financial state back to an honest empty state. Requires an explicit
 * `{ confirm: true }` body (the in-app confirmation dialog is the actual
 * gate here). This MVP has no authentication on any route - see the
 * "Known limitations" section in the PR/README before deploying anywhere
 * other than a local/private demo.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  }
  void body;

  try {
    await resetDemoProfile(DEMO_PROFILE_ID);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "supabase_not_configured", missing: error.missingEnvVars },
        { status: 503 },
      );
    }
    console.error("[POST /api/reset]", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
