import { NextResponse } from "next/server";
import { DEMO_PROFILE_ID } from "@/lib/constants";
import { calculateFinancialSummary } from "@/lib/finance/engine";
import { getFinancialState } from "@/lib/supabase/repository";
import { SupabaseNotConfiguredError } from "@/lib/supabase/client";

export async function GET() {
  try {
    const state = await getFinancialState(DEMO_PROFILE_ID);
    const summary = calculateFinancialSummary(state);
    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "supabase_not_configured", missing: error.missingEnvVars },
        { status: 503 },
      );
    }
    console.error("[GET /api/finance]", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
