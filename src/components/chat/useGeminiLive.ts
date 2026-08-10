"use client";

import { useCallback, useRef, useState } from "react";
import { GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";
import { arrayBufferToBase64, base64ToArrayBuffer, downsample, floatTo16BitPCM, int16PCMToFloat } from "@/lib/audio/pcm";
import type { AssistantAction } from "@/lib/ai/provider";

export type VoiceStatus = "idle" | "connecting" | "listening" | "error";

export interface VoiceExchange {
  userText: string;
  assistantText: string;
  actions: AssistantAction[];
}

interface UseGeminiLiveOptions {
  onExchange: (exchange: VoiceExchange) => void;
  onPartial?: (partial: { userText: string; assistantText: string }) => void;
}

/**
 * Browser-side bridge to Gemini Live. Opens a direct WebSocket session to
 * Gemini using a short-lived ephemeral token (never the real API key - see
 * /api/voice/token), streams microphone audio to it, plays back the
 * model's audio, and executes any tool calls via /api/tools/execute (the
 * same tool layer text chat uses). This is a best-effort realtime layer on
 * top of the text flow: any failure here surfaces as a status/error and
 * never affects the text chat, which works independently.
 */
export function useGeminiLive({ onExchange, onPartial }: UseGeminiLiveOptions) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const captureNodesRef = useRef<{
    source?: MediaStreamAudioSourceNode;
    processor?: ScriptProcessorNode;
    gain?: GainNode;
  }>({});
  const nextPlaybackTimeRef = useRef(0);

  const userTextRef = useRef("");
  const assistantTextRef = useRef("");
  const actionsRef = useRef<AssistantAction[]>([]);
  /** Bumped on every teardown so in-flight async work (tool calls) can detect the session it belonged to is gone and stop touching shared refs. */
  const epochRef = useRef(0);

  const cleanup = useCallback(() => {
    epochRef.current += 1;
    sessionRef.current?.close();
    sessionRef.current = null;

    captureNodesRef.current.processor?.disconnect();
    captureNodesRef.current.source?.disconnect();
    captureNodesRef.current.gain?.disconnect();
    captureNodesRef.current = {};

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    captureCtxRef.current?.close().catch(() => {});
    captureCtxRef.current = null;
    playbackCtxRef.current?.close().catch(() => {});
    playbackCtxRef.current = null;
    nextPlaybackTimeRef.current = 0;

    userTextRef.current = "";
    assistantTextRef.current = "";
    actionsRef.current = [];
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setStatus("idle");
  }, [cleanup]);

  const playChunk = useCallback((base64: string) => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return;
    const float32 = int16PCMToFloat(base64ToArrayBuffer(base64));
    if (float32.length === 0) return;
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, nextPlaybackTimeRef.current);
    source.start(startAt);
    nextPlaybackTimeRef.current = startAt + buffer.duration;
  }, []);

  const handleMessage = useCallback(
    async (message: LiveServerMessage) => {
      const epoch = epochRef.current;

      if (message.serverContent?.interrupted && playbackCtxRef.current) {
        nextPlaybackTimeRef.current = playbackCtxRef.current.currentTime;
      }

      if (message.data) {
        playChunk(message.data);
      }

      const inputChunk = message.serverContent?.inputTranscription?.text;
      if (inputChunk) {
        userTextRef.current += inputChunk;
        onPartial?.({ userText: userTextRef.current, assistantText: assistantTextRef.current });
      }
      const outputChunk = message.serverContent?.outputTranscription?.text;
      if (outputChunk) {
        assistantTextRef.current += outputChunk;
        onPartial?.({ userText: userTextRef.current, assistantText: assistantTextRef.current });
      }

      const calls = message.toolCall?.functionCalls;
      if (calls && calls.length > 0) {
        const responses = await Promise.all(
          calls.map(async (call) => {
            try {
              const res = await fetch("/api/tools/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: call.name, args: call.args ?? {} }),
              });
              const body = await res.json();
              // The session this call belonged to may have been torn down (error/close/unmount)
              // while the fetch was in flight - don't push its result into a reused ref.
              if (epochRef.current !== epoch) {
                return { id: call.id, name: call.name, response: { error: "Session ended" } };
              }
              if (body.status === "ok") {
                actionsRef.current.push({
                  toolName: call.name ?? "",
                  args: call.args ?? {},
                  message: body.message,
                  data: body.data,
                });
                return { id: call.id, name: call.name, response: { output: body.data } };
              }
              return { id: call.id, name: call.name, response: { error: body.error ?? "Tool failed" } };
            } catch {
              return { id: call.id, name: call.name, response: { error: "Network error running tool" } };
            }
          }),
        );
        if (epochRef.current === epoch) {
          sessionRef.current?.sendToolResponse({ functionResponses: responses });
        }
      }

      if (epochRef.current === epoch && message.serverContent?.turnComplete) {
        if (userTextRef.current || assistantTextRef.current || actionsRef.current.length > 0) {
          onExchange({
            userText: userTextRef.current,
            assistantText: assistantTextRef.current,
            actions: actionsRef.current,
          });
        }
        userTextRef.current = "";
        assistantTextRef.current = "";
        actionsRef.current = [];
      }
    },
    [onExchange, onPartial, playChunk],
  );

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    try {
      if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Voice isn't supported in this browser.");
      }

      const tokenRes = await fetch("/api/voice/token", { method: "POST" });
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(
          body.error === "ai_not_configured" ? "Voice isn't configured yet (missing GEMINI_API_KEY)." : "Couldn't start voice mode.",
        );
      }
      const { token, model } = (await tokenRes.json()) as { token: string; model: string };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });
      const session = await ai.live.connect({
        model,
        callbacks: {
          onopen: () => setStatus("listening"),
          onmessage: (m) => {
            void handleMessage(m);
          },
          onerror: () => {
            setError("Voice connection error - try again or use text.");
            setStatus("error");
            cleanup();
          },
          onclose: () => {
            // Handles a server-initiated close (token/session expiry, network drop) - without
            // this the mic stream and audio contexts would keep running with no way to stop them.
            cleanup();
            setStatus((s) => (s === "error" ? s : "idle"));
          },
        },
      });
      sessionRef.current = session;

      const captureCtx = new AudioContext();
      captureCtxRef.current = captureCtx;
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });

      const source = captureCtx.createMediaStreamSource(stream);
      const processor = captureCtx.createScriptProcessor(4096, 1, 1);
      const silentGain = captureCtx.createGain();
      silentGain.gain.value = 0; // never play the raw mic input back out loud
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(captureCtx.destination);

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const resampled = downsample(input, captureCtx.sampleRate, 16000);
        const pcm = floatTo16BitPCM(resampled);
        sessionRef.current?.sendRealtimeInput({
          audio: { data: arrayBufferToBase64(pcm), mimeType: "audio/pcm;rate=16000" },
        });
      };

      captureNodesRef.current = { source, processor, gain: silentGain };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start voice mode.");
      setStatus("error");
      cleanup();
    }
  }, [cleanup, handleMessage]);

  return { status, error, connect, disconnect };
}
