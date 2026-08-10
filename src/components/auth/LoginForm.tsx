"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body.error === "not_configured"
            ? "The demo password isn't configured yet - the site administrator needs to set DEMO_PASSWORD."
            : "Incorrect password.",
        );
        return;
      }
      const next = searchParams.get("next") || "/";
      router.replace(next);
      router.refresh();
    } catch {
      setError("Couldn't reach the server - check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full p-8 shadow-tactile">
      <p className="text-3xl">🔒</p>
      <h1 className="mt-3 text-2xl font-extrabold text-ink">{PRODUCT_NAME}</h1>
      <p className="mt-1 text-sm text-ink-soft">{PRODUCT_TAGLINE}</p>
      <p className="mt-4 text-sm text-ink-soft">Enter the demo password to continue.</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Demo password"
          className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-sm font-medium text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
        />
        {error ? <p className="text-xs font-semibold text-warn-dark">{error}</p> : null}
        <Button type="submit" disabled={busy || !password} className="w-full justify-center">
          {busy ? "Checking…" : "Enter demo"}
        </Button>
      </form>
    </Card>
  );
}
