"use client";

import { useEffect, useRef, useState } from "react";
import { BalanceHero } from "./BalanceHero";
import { BudgetCategories } from "./BudgetCategories";
import { UpcomingCommitments } from "./UpcomingCommitments";
import { RecentTransactions } from "./RecentTransactions";
import { GoalsPanel } from "./GoalsPanel";
import { EmptyState } from "./EmptyState";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useGeminiLive } from "@/components/chat/useGeminiLive";
import type { DisplayMessage } from "@/components/chat/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { PRODUCT_NAME, PRODUCT_TAGLINE, DISCLAIMER } from "@/lib/brand";
import { formatMoney } from "@/lib/finance/format";
import type { FinancialSummary } from "@/lib/finance/engine";
import type { ChatTurn } from "@/lib/ai/provider";

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function isEmptyProfile(summary: FinancialSummary): boolean {
  return (
    summary.profile.currentBalance === 0 &&
    summary.budgetCategories.length === 0 &&
    summary.recentTransactions.length === 0 &&
    summary.goals.length === 0 &&
    summary.nextIncome === null
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
  const [summary, setSummary] = useState(initialSummary);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

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

  async function handleSend(text: string) {
    const history: ChatTurn[] = messages
      .filter((m) => !m.pending && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    const userMessage: DisplayMessage = { id: newId(), role: "user", content: text };
    const pendingId = newId();
    setMessages((prev) => [...prev, userMessage, { id: pendingId, role: "assistant", content: "Thinking…", pending: true }]);
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errorText =
          body.error === "ai_not_configured"
            ? "The AI companion isn't configured yet (missing GEMINI_API_KEY)."
            : body.error === "supabase_not_configured"
              ? "The database isn't configured yet."
              : body.error === "rate_limited"
                ? `Gemini's free tier is rate-limited right now - wait ${body.retryAfterSeconds ? `${Math.ceil(body.retryAfterSeconds)}s` : "a few seconds"} and try again.`
                : "Something went wrong on my end - try again in a moment.";
        setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, content: errorText, pending: false, error: true } : m)));
        return;
      }

      const data: { reply: string; actions: DisplayMessage["actions"] } = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, content: data.reply, actions: data.actions, pending: false } : m)),
      );

      if (data.actions && data.actions.length > 0) {
        await refreshSummary();
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, content: "Couldn't reach the server - check your connection and try again.", pending: false, error: true } : m)),
      );
    } finally {
      setIsSending(false);
    }
  }

  const voicePendingRef = useRef<{ userId: string; assistantId: string } | null>(null);

  const {
    status: voiceStatus,
    error: voiceError,
    connect: connectVoice,
    disconnect: disconnectVoice,
  } = useGeminiLive({
    onPartial: ({ userText, assistantText }) => {
      if (!voicePendingRef.current) {
        const userId = newId();
        const assistantId = newId();
        voicePendingRef.current = { userId, assistantId };
        setMessages((prev) => [
          ...prev,
          { id: userId, role: "user", content: userText || "…" },
          { id: assistantId, role: "assistant", content: assistantText || "…", pending: true },
        ]);
        return;
      }
      const { userId, assistantId } = voicePendingRef.current;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === userId) return { ...m, content: userText || "…" };
          if (m.id === assistantId) return { ...m, content: assistantText || "…" };
          return m;
        }),
      );
    },
    onExchange: ({ userText, assistantText, actions }) => {
      const pending = voicePendingRef.current;
      voicePendingRef.current = null;
      if (pending) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === pending.userId) return { ...m, content: userText || m.content };
            if (m.id === pending.assistantId) {
              return { ...m, content: assistantText || "(no reply)", actions, pending: false };
            }
            return m;
          }),
        );
      } else if (userText || assistantText) {
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: "user", content: userText },
          { id: newId(), role: "assistant", content: assistantText || "(no reply)", actions, pending: false },
        ]);
      }
      if (actions.length > 0) {
        void refreshSummary();
      }
    },
  });

  useEffect(() => {
    return () => disconnectVoice();
  }, [disconnectVoice]);

  function handleMicClick() {
    if (voiceStatus === "listening" || voiceStatus === "connecting") {
      disconnectVoice();
    } else {
      void connectVoice();
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
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{PRODUCT_NAME}</h1>
          <p className="text-sm text-ink-soft">{PRODUCT_TAGLINE}</p>
        </div>
        <Button variant="ghost" onClick={() => setResetOpen(true)}>
          Reset demo data
        </Button>
      </header>

      {!geminiConfigured ? (
        <Card className="mt-6 border-caution/40 bg-caution-light p-4 text-sm font-semibold text-caution-dark">
          AI companion not configured — set {geminiMissing.join(", ")} to enable chat. The dashboard below still
          reflects real stored data.
        </Card>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {empty ? (
            <EmptyState />
          ) : (
            <>
              <BalanceHero summary={summary} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatTile
                  label="Discretionary remaining"
                  value={formatMoney(summary.discretionaryCash, summary.profile.currency)}
                  sublabel="before your next income"
                />
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
          <div className="lg:sticky lg:top-8">
            <ChatPanel
              messages={messages}
              onSend={handleSend}
              isSending={isSending}
              statusMessage={
                isSending
                  ? "Checking your budget…"
                  : voiceStatus === "connecting"
                    ? "Connecting voice…"
                    : voiceStatus === "listening"
                      ? "Listening…"
                      : null
              }
              onMicClick={geminiConfigured ? handleMicClick : undefined}
              micActive={voiceStatus === "listening" || voiceStatus === "connecting"}
              voiceError={voiceError}
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
