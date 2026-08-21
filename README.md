# Runway

A voice-capable AI financial companion for university students. Runway
tells you how long your money can last and what's safe to spend before your
next payment. Tell it your financial situation in plain language; it
extracts structured data, persists it, and answers questions like "Can I
afford a £500 desk?" using a deterministic budgeting engine — never
LLM-invented numbers.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase/Postgres for persistent financial state
- Gemini (text + tool calling) behind a provider-agnostic `AIProvider` interface
- Browser-native speech-to-text (Web Speech API) for voice input - no extra credential, no server round trip for recognition itself
- Vitest for the financial engine, tool layer and AI provider

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` - Supabase project settings
   - `GEMINI_API_KEY` - [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - `DEMO_PASSWORD` - any password you choose; leave unset for local dev to skip the login screen (see below)
3. Run the SQL in `supabase/migrations/` (in order) via the Supabase SQL editor or CLI. This creates the schema and seeds the single demo profile row the app uses.
4. `npm run dev` and open http://localhost:3000

If Supabase or Gemini env vars are missing, the app tells you exactly which
ones on screen instead of silently faking data.

### Demo access gate

Not a user account system - there's one shared demo financial profile, and
`DEMO_PASSWORD` just gates who can reach it. `src/proxy.ts` (Next's
successor to Middleware) checks a signed, HTTP-only session cookie on
every page and API request and redirects/rejects anyone without one; the
password itself never reaches the browser. Log in at `/login`; "Lock
demo" in the header clears the cookie. Leave `DEMO_PASSWORD` unset in
local dev and the gate is skipped entirely for convenience - but if it's
unset wherever `NODE_ENV=production` (any real deployment, including
Vercel preview builds), the app fails closed instead: nobody can log in
until it's configured, rather than silently exposing the demo.

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm test` - Vitest (financial engine, tool layer, Gemini tool-loop)
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
  lib/auth/session.ts       signed demo-session cookie (create/verify) - no database, no user accounts
  proxy.ts                  gates every page/API request behind the demo password (Next 16's Middleware successor)
  components/chat/
    useSpeechToText.ts       browser-native speech-to-text; hands the final transcript to the same send path as typed input
  app/api/                  chat, finance, reset, session (login/logout) route handlers
  app/login/                demo password entry screen
```

Swapping Gemini for another provider means writing a new class that
implements `AIProvider` against the same `tools.ts` - the database logic,
financial engine, tool definitions and UI never change. Voice is a thin
input adapter in front of that same pipeline - speech becomes text, then
follows the identical `/api/chat` path as anything typed.

## Demo script

Text or voice, identical either way:

1. Fresh profile: "I've got £4,500 left from my maintenance loan. My next
   Student Finance payment is £3,000 in January. Rent is £650 a month, food
   is around £55 a week, my gym is £25 a month and I spend about £50 a week
   going out."
2. "Can I afford a £500 desk?"
3. "I found one for £180 and bought it."
4. "Can I still afford to go out this weekend?"

Voice: click the mic, allow microphone access, and say a line - the
recognized transcript is shown in the input field and sent automatically
once you stop speaking. Chrome and Safari both support this natively;
unsupported browsers get a clear message and text still works.

Reset: "Reset demo data" in the header clears the demo profile back to an
honest empty state (confirmation required).

## Known limitations

- **One shared demo profile, gated by a single password.** This is access
  protection for a hackathon demo, not per-user accounts - everyone who
  knows `DEMO_PASSWORD` sees and edits the same financial data.
- **Voice is speech-to-text only.** The assistant always replies in text,
  even when you spoke - there's no spoken reply. This was a deliberate
  scope decision for reliability within the hackathon timeframe.
- **Voice recognition quality/availability depends on the browser.** It
  uses each browser's built-in engine (Chrome and Safari both support it);
  browsers without support show a clear message and fall back to text.
- **Date-only fields and server timezone.** `next_due_date`/income `date`
  are stored as calendar dates (no timezone) and compared against the
  server's clock; a student in a very different timezone from the
  deployment could see a day's difference in "next payment" timing right at
  a date boundary.
