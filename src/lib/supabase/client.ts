import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Thrown whenever code tries to touch the database but the required
 * Supabase environment variables are not set. Callers (API routes, server
 * components) catch this and surface the exact missing variable names
 * instead of crashing or silently falling back to fake data.
 */
export class SupabaseNotConfiguredError extends Error {
  missingEnvVars: string[];

  constructor(missingEnvVars: string[]) {
    super(`Supabase is not configured. Missing environment variable(s): ${missingEnvVars.join(", ")}`);
    this.name = "SupabaseNotConfiguredError";
    this.missingEnvVars = missingEnvVars;
  }
}

export interface SupabaseConfigStatus {
  configured: boolean;
  missing: string[];
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const missing: string[] = [];
  if (!process.env.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return { configured: missing.length === 0, missing };
}

let cachedClient: SupabaseClient | null = null;

/**
 * `createClient` wants the bare project URL (`https://<ref>.supabase.co`)
 * and appends `/rest/v1` itself. Supabase's dashboard also shows a "REST
 * API URL" that already has that suffix, which is an easy value to
 * copy-paste by mistake and produces confusing PostgREST errors - strip it
 * defensively so either value works.
 */
export function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

/**
 * Server-only Supabase client authenticated with the service role key.
 * Never import this from a client component. Row Level Security is
 * enabled on every table with no policies, so only this service-role
 * client can read or write - see supabase/migrations/0001_schema.sql.
 */
export function getSupabaseClient(): SupabaseClient {
  const status = getSupabaseConfigStatus();
  if (!status.configured) {
    throw new SupabaseNotConfiguredError(status.missing);
  }
  if (!cachedClient) {
    cachedClient = createClient(normalizeSupabaseUrl(process.env.SUPABASE_URL!), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return cachedClient;
}
