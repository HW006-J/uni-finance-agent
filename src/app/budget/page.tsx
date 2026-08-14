import { DEMO_PROFILE_ID } from "@/lib/constants";
import { calculateFinancialSummary, type FinancialSummary } from "@/lib/finance/engine";
import { getFinancialState } from "@/lib/supabase/repository";
import { SupabaseNotConfiguredError, getSupabaseConfigStatus } from "@/lib/supabase/client";
import { getGeminiConfigStatus } from "@/lib/ai";
import { SetupRequired } from "@/components/setup/SetupRequired";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card } from "@/components/ui/Card";

// Financial state changes on every chat turn - never prerender/cache this page.
export const dynamic = "force-dynamic";

type LoadResult =
  | { kind: "not_configured"; missing: string[] }
  | { kind: "load_error"; message: string }
  | { kind: "ready"; summary: FinancialSummary };

async function loadDashboardData(): Promise<LoadResult> {
  try {
    const state = await getFinancialState(DEMO_PROFILE_ID);
    return { kind: "ready", summary: calculateFinancialSummary(state) };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return { kind: "not_configured", missing: error.missingEnvVars };
    }
    return { kind: "load_error", message: error instanceof Error ? error.message : String(error) };
  }
}

export default async function HomePage() {
  const supabaseStatus = getSupabaseConfigStatus();
  const geminiStatus = getGeminiConfigStatus();

  if (!supabaseStatus.configured) {
    return <SetupRequired missingSupabase={supabaseStatus.missing} missingGemini={geminiStatus.missing} />;
  }

  const result = await loadDashboardData();

  if (result.kind === "not_configured") {
    return <SetupRequired missingSupabase={result.missing} missingGemini={geminiStatus.missing} />;
  }

  if (result.kind === "load_error") {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16">
        <Card className="w-full p-8 shadow-tactile">
          <p className="text-3xl">⚠️</p>
          <h1 className="mt-3 text-2xl font-extrabold text-ink">Couldn&rsquo;t load your financial data</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Supabase credentials are set, but the query failed. Make sure you&rsquo;ve run the SQL migrations in{" "}
            <code className="font-bold">supabase/migrations/</code> (in order) so the schema and demo profile
            exist.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-cream-dark p-4 text-xs text-ink-soft">{result.message}</pre>
        </Card>
      </main>
    );
  }

  return (
    <DashboardShell
      initialSummary={result.summary}
      geminiConfigured={geminiStatus.configured}
      geminiMissing={geminiStatus.missing}
    />
  );
}
