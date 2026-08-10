import { Card } from "@/components/ui/Card";
import { PRODUCT_NAME } from "@/lib/brand";

function EnvRow({ name, hint }: { name: string; hint: string }) {
  return (
    <li className="flex flex-col gap-1 rounded-2xl bg-cream-dark px-4 py-3">
      <code className="text-sm font-bold text-ink">{name}</code>
      <span className="text-xs text-ink-soft">{hint}</span>
    </li>
  );
}

export function SetupRequired({ missingSupabase, missingGemini }: { missingSupabase: string[]; missingGemini: string[] }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16">
      <Card className="w-full p-8 shadow-tactile">
        <p className="text-3xl">🔧</p>
        <h1 className="mt-3 text-2xl font-extrabold text-ink">{PRODUCT_NAME} needs a couple of credentials</h1>
        <p className="mt-2 text-sm text-ink-soft">
          This app never invents financial data - it waits for real persistence and a real AI provider to be
          configured. Add the environment variable(s) below to <code className="font-bold">.env.local</code> (copy
          from <code className="font-bold">.env.example</code>) and restart the dev server.
        </p>

        {missingSupabase.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-sm font-extrabold text-ink">Supabase (persistent financial state)</h2>
            <ul className="mt-3 space-y-2">
              {missingSupabase.includes("SUPABASE_URL") && (
                <EnvRow name="SUPABASE_URL" hint="Supabase dashboard → Project Settings → Data API → Project URL" />
              )}
              {missingSupabase.includes("SUPABASE_SERVICE_ROLE_KEY") && (
                <EnvRow
                  name="SUPABASE_SERVICE_ROLE_KEY"
                  hint="Supabase dashboard → Project Settings → API Keys → service_role (secret, server-only)"
                />
              )}
            </ul>
            <p className="mt-3 text-xs text-ink-soft">
              Then run the SQL in <code className="font-bold">supabase/migrations/</code> (in order) via the SQL
              editor or the Supabase CLI to create the schema and seed the single demo profile.
            </p>
          </section>
        ) : null}

        {missingGemini.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-sm font-extrabold text-ink">Gemini (the AI companion)</h2>
            <ul className="mt-3 space-y-2">
              <EnvRow name="GEMINI_API_KEY" hint="Get a free-tier key at aistudio.google.com/apikey" />
            </ul>
          </section>
        ) : null}

        <p className="mt-6 text-xs text-ink-soft">
          Never paste real secrets into a chat assistant — set them directly in your environment or hosting
          provider&rsquo;s dashboard.
        </p>
      </Card>
    </main>
  );
}
