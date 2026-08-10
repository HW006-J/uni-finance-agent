"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/cx";
import { MessageBubble } from "./MessageBubble";
import type { DisplayMessage } from "./types";

export function ChatPanel({
  messages,
  onSend,
  isSending,
  statusMessage,
  onMicClick,
  micActive = false,
  voiceError,
  liveTranscript,
}: {
  messages: DisplayMessage[];
  onSend: (text: string) => void;
  isSending: boolean;
  statusMessage?: string | null;
  onMicClick?: () => void;
  micActive?: boolean;
  voiceError?: string | null;
  /** Live speech-to-text transcript, shown in the input field while listening. */
  liveTranscript?: string;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  // While listening, the input just mirrors the live transcript - derived
  // directly at render time rather than synced via an effect.
  const displayValue = micActive ? (liveTranscript ?? "") : input;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, statusMessage]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed);
    setInput("");
  }

  return (
    <Card className="flex h-full flex-col p-5 shadow-tactile">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-ink">Talk it through</h2>
        {statusMessage ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-dark">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
            {statusMessage}
          </span>
        ) : null}
      </div>

      <div ref={scrollRef} className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1" style={{ maxHeight: 480, minHeight: 280 }}>
        {messages.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Try: &ldquo;I&rsquo;ve got £4,500 left, rent is £650 a month, food is £55 a week&rdquo;
          </p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
        <input
          value={displayValue}
          onChange={(e) => setInput(e.target.value)}
          placeholder={micActive ? "Listening…" : "Tell me what's going on with your money…"}
          disabled={isSending || micActive}
          className="min-w-0 flex-1 rounded-2xl border border-border bg-cream px-4 py-3 text-sm font-medium text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none disabled:opacity-70"
        />
        {onMicClick ? (
          <button
            type="button"
            onClick={onMicClick}
            title={micActive ? "Stop listening" : "Talk instead of type"}
            className={cx(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl transition-all active:translate-y-px",
              micActive ? "bg-warn text-white" : "bg-accent text-white hover:bg-accent-dark",
            )}
          >
            {micActive ? "■" : "🎙️"}
          </button>
        ) : null}
        <Button type="submit" disabled={isSending || micActive || !input.trim()} className="shrink-0">
          Send
        </Button>
      </form>
      {voiceError ? <p className="mt-2 text-xs font-semibold text-warn-dark">{voiceError}</p> : null}
    </Card>
  );
}
