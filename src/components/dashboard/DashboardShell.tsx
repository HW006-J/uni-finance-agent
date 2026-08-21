"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BalanceHero } from "./BalanceHero";
import { BudgetCategories } from "./BudgetCategories";
import { UpcomingCommitments } from "./UpcomingCommitments";
import { RecentTransactions } from "./RecentTransactions";
import { GoalsPanel } from "./GoalsPanel";
import { EmptyState } from "./EmptyState";
import { MoneyTipCard } from "./MoneyTipCard";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useSpeechToText } from "@/components/chat/useSpeechToText";
import type { DisplayMessage } from "@/components/chat/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { AppHeader } from "@/components/nav/AppHeader";
import { DISCLAIMER } from "@/lib/brand";
import { formatMoney } from "@/lib/finance/format";
import type { FinancialSummary } from "@/lib/finance/engine";
import type { ChatTurn } from "@/lib/ai/provider";

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function isEmptyProfile(summary: FinancialSummary): boolean {
  return (
    !summary.profile.balanceKnown &&
    summary.budgetCategories.length === 0 &&
    summary.recentTransactions.length === 0 &&
    summary.goals.length === 0 &&
    summary.nextMajorPayment === null &&
    summary.recurringIncomes.length === 0 &&
    summary.fundingAwards.length === 0
  );
}

export function DashboardShell({
  initialSummary,
  geminiConfigured,
  geminiMissing,
}: {
  initialSummary: FinancialSummary;
  geminiConfigured: boolean;
  geminiMissing: string[];
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [lockingOut, setLockingOut] = useState(false);

  async function handleLockDemo() {
    setLockingOut(true);
    try {
      await fetch("/api/session", { method: "DELETE" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  async function refreshSummary() {
    try {
      const res = await fetch("/api/finance");
      if (!res.ok) return;
      const data = await res.json();
      setSummary(data.summary);
    } catch {
      // Dashboard just keeps showing the last known-good summary.
    }
  }

  // Hard client-side backstop so the "..." bubble is guaranteed to clear even
  // if the server-side timeout (see CONVERSE_TIMEOUT_MS in gemini-provider.ts,
  // ~45s) somehow doesn't fire - a bit longer than that so the server's own
  // clear error message wins the race in the normal case.
  const CHAT_TIMEOUT_MS = 60_000;

  async function handleSend(text: string) {
    const history: ChatTurn[] = messages
      .filter((m) => !m.pending && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    const userMessage: DisplayMessage = { id: newId(), role: "user", content: text };
    const pendingId = newId();
    setMessages((prev) => [...prev, userMessage, { id: pendingId, role: "assistant", content: "Thinking…", pending: true }]);
    setIsSending(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errorText =
          body.error === "ai_not_configured"
            ? "The AI companion isn't configured yet (missing GEMINI_API_KEY)."
            : body.error === "supabase_not_configured"
              ? "The database isn't configured yet."
              : body.error === "rate_limited"
                ? `Gemini is temporarily rate-limited — try again in ${body.retryAfterSeconds ? `${Math.ceil(body.retryAfterSeconds)}s` : "a few seconds"}. Anything already confirmed above was saved.`
                : body.error === "timeout"
                  ? "Gemini is taking too long to respond (likely rate-limited) — try again shortly. Anything already confirmed above was saved."
                  : "Something went wrong on my end - try again in a moment.";
        setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, content: errorText, pending: false, error: true } : m)));
        // A slow/failed reply doesn't mean nothing happened - tool calls the
        // model already made before the failure are real, already-committed
        // writes. Pick those up rather than leaving the dashboard stale.
        await refreshSummary();
        return;
      }

      const data: { reply: string; actions: DisplayMessage["actions"] } = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, content: data.reply, actions: data.actions, pending: false } : m)),
      );

      if (data.actions && data.actions.length > 0) {
        await refreshSummary();
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const errorText = isAbort
        ? "Gemini is temporarily rate-limited or taking too long — try again shortly. Anything already confirmed above was saved."
        : "Couldn't reach the server - check your connection and try again.";
      setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, content: errorText, pending: false, error: true } : m)));
      await refreshSummary();
    } finally {
      clearTimeout(timeoutId);
      setIsSending(false);
    }
  }

  // Real browser speech-to-text (no server round trip, no Gemini
  // involvement in recognition itself). The recognized transcript is
  // submitted through the exact same handleSend used for typed input, so
  // voice and text share identical business logic end to end.
  const {
    status: speechStatus,
    interimTranscript,
    error: speechError,
    start: startListening,
    stop: stopListening,
  } = useSpeechToText({
    onFinalTranscript: (text) => {
      void handleSend(text);
    },
  });

  function handleMicClick() {
    if (speechStatus === "listening") {
      stopListening();
    } else {
      startListening();
    }
  }

  async function handleReset() {
    setResetBusy(true);
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (res.ok) {
        await refreshSummary();
        setMessages([]);
      }
    } finally {
      setResetBusy(false);
      setResetOpen(false);
    }
  }

  const empty = isEmptyProfile(summary);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <AppHeader
        actions={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(true)}>
              Reset demo data
            </Button>
            <Button variant="ghost" onClick={handleLockDemo} disabled={lockingOut}>
              Lock demo
            </Button>
          </>
        }
      />

      {!geminiConfigured ? (
        <Card className="mt-6 border-caution/40 bg-caution-light p-4 text-sm font-semibold text-caution-dark">
          AI companion not configured — set {geminiMissing.join(", ")} to enable chat. The dashboard below still
          reflects real stored data.
        </Card>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {empty ? (
            <>
              <EmptyState />
              <MoneyTipCard context={{ page: "budget", summary }} />
            </>
          ) : (
            <>
              <BalanceHero summary={summary} />
              <MoneyTipCard context={{ page: "budget", summary }} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatTile
                  label="Committed spend"
                  value={`${formatMoney(summary.committedSpend.weekly, summary.profile.currency)}/wk`}
                  sublabel="rent, bills, subscriptions and more"
                />
                <StatTile
                  label="Essential spend"
                  value={`${formatMoney(summary.essentialSpend.weekly, summary.profile.currency)}/wk`}
                  sublabel="the needs inside committed spend"
                />
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <BudgetCategories summary={summary} />
                <UpcomingCommitments summary={summary} />
              </div>
              <RecentTransactions summary={summary} />
              <GoalsPanel summary={summary} />
            </>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)]">
            <ChatPanel
              messages={messages}
              onSend={handleSend}
              isSending={isSending}
              statusMessage={isSending ? "Checking your budget…" : speechStatus === "listening" ? "Listening…" : null}
              onMicClick={geminiConfigured ? handleMicClick : undefined}
              micActive={speechStatus === "listening"}
              voiceError={speechError}
              liveTranscript={speechStatus === "listening" ? interimTranscript : undefined}
            />
          </div>
        </div>
      </div>

      <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-ink-faint">{DISCLAIMER}</p>

      {resetOpen ? (
        <ConfirmDialog
          title="Reset demo data?"
          description="This clears the demo profile's balance, income, expenses, transactions and goals back to an empty state. This can't be undone."
          confirmLabel="Reset"
          busy={resetBusy}
          onConfirm={handleReset}
          onCancel={() => setResetOpen(false)}
        />
      ) : null}
    </main>
  );
}
