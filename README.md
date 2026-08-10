# Wallet Buddy

A voice-first AI financial companion for university students. Tell it your
financial situation in plain language; it extracts structured data,
persists it, and answers questions like *"Can I afford a £500 desk?"* using
a deterministic budgeting engine — never LLM-invented numbers.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase/Postgres for persistent financial state
- Gemini (text + Live voice) behind a provider-agnostic `AIProvider` interface
- Vitest for the financial engine, tool layer and PCM audio helpers

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` - Supabase project settings
   - `GEMINI_API_KEY` - [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
3. Run the SQL in `supabase/migrations/` (in order) via the Supabase SQL editor or CLI. This creates the schema and seeds the single demo profile row the app uses (no auth in this MVP).
4. `npm run dev` and open http://localhost:3000

If Supabase or Gemini env vars are missing, the app tells you exactly which
ones on screen instead of silently faking data.

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm test` - Vitest (financial engine, tool layer, Gemini tool-loop, PCM helpers)
- `npm run lint` - ESLint

## Architecture

```
src/
  types/finance.ts          domain types (Profile, Income, Expense, Transaction, Goal)
  lib/finance/engine.ts     pure, deterministic budgeting/affordability functions - the ONLY place money is calculated
  lib/supabase/             Supabase client + repository (all DB access goes through here)
  lib/ai/
    provider.ts             provider-agnostic AIProvider interface
    tools.ts                zod-validated tool layer - the only way any AI can touch data
    gemini-provider.ts       Gemini implementation of AIProvider (text)
  components/chat/useGeminiLive.ts   browser-side Gemini Live voice bridge
  app/api/                  chat, finance, reset, voice/token, tools/execute route handlers
```

Swapping Gemini for another provider means writing a new class that
implements `AIProvider` against the same `tools.ts` - the database logic,
financial engine, tool definitions and UI never change.

## Demo script

1. Fresh profile: *"I've got £4,500 left from my maintenance loan. My next
   Student Finance payment is £3,000 in January. Rent is £650 a month, food
   is around £55 a week, my gym is £25 a month and I spend about £50 a week
   going out."*
2. *"Can I afford a £500 desk?"*
3. *"I found one for £180 and bought it."*
4. *"Can I still afford to go out this weekend?"*

Voice: click the mic and say the same things out loud (needs `GEMINI_API_KEY`
and mic permission).

Reset: "Reset demo data" in the header clears the demo profile back to an
honest empty state (confirmation required).

## Known limitations

- **No authentication.** Every route operates on a single fixed demo
  profile. Fine for a local/private hackathon demo; do not deploy this to a
  public URL without adding an auth layer first.
- **Voice is best-effort.** It couldn't be exercised live in the environment
  this was built in (no mic/speaker/real API key available there) - the
  text flow is the reliable fallback and works independently of voice.
- **Date-only fields and server timezone.** `next_due_date`/income `date`
  are stored as calendar dates (no timezone) and compared against the
  server's clock; a student in a very different timezone from the
  deployment could see a day's difference in "next payment" timing right at
  a date boundary.
- **`GEMINI_LIVE_MODEL`** defaults to a specific native-audio preview model
  name that may have moved on by the time you read this - override the env
  var if Gemini reports it as unavailable.
