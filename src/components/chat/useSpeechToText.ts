"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechStatus = "idle" | "listening" | "error";

/**
 * Minimal typing for the Web Speech API's SpeechRecognition - it isn't
 * part of TypeScript's DOM lib (non-standard, Chromium/WebKit only), so we
 * declare just the surface this hook actually uses.
 */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  readonly [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

/** Hard safety cap so the mic UI can never be left listening indefinitely, even if the browser's own end/error events misbehave. */
const MAX_LISTEN_MS = 20_000;

export function describeError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission denied - allow access in your browser's settings and try again.";
    case "no-speech":
      return "Didn't catch that - try again.";
    case "audio-capture":
      return "No microphone found - check your device and try again.";
    case "network":
      return "Voice recognition network error - try again.";
    case "aborted":
      return "";
    default:
      return "Voice recognition failed - try again or use text.";
  }
}

interface UseSpeechToTextOptions {
  /** Called once with the final recognized transcript - the caller submits it exactly like typed text. */
  onFinalTranscript: (transcript: string) => void;
}

/**
 * Real, browser-native speech-to-text (Web Speech API - no server round
 * trip, no Gemini involvement, no mocked/simulated recognition). The
 * recognized transcript is handed to the caller to submit through the
 * existing /api/chat text pipeline, so voice and typed input share
 * identical business logic end to end.
 */
export function useSpeechToText({ onFinalTranscript }: UseSpeechToTextOptions) {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supported = isSpeechRecognitionSupported();

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    setError(null);
    setInterimTranscript("");

    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      setStatus("error");
      setError("Voice input isn't supported in this browser - try Chrome or Safari, or use text instead.");
      return;
    }

    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.lang = "en-GB";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setStatus("listening");

    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (finalText.trim()) {
        setInterimTranscript(finalText.trim());
        onFinalTranscript(finalText.trim());
      } else if (interim) {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event) => {
      const message = describeError(event.error);
      if (message) {
        setError(message);
        setStatus("error");
      } else {
        setStatus("idle");
      }
    };

    recognition.onend = () => {
      clearSafetyTimer();
      recognitionRef.current = null;
      setStatus((s) => (s === "listening" ? "idle" : s));
    };

    recognitionRef.current = recognition;
    recognition.start();

    clearSafetyTimer();
    safetyTimerRef.current = setTimeout(() => {
      recognitionRef.current?.stop();
    }, MAX_LISTEN_MS);
  }, [clearSafetyTimer, onFinalTranscript]);

  useEffect(() => {
    return () => {
      clearSafetyTimer();
      recognitionRef.current?.abort();
    };
  }, [clearSafetyTimer]);

  return { status, interimTranscript, error, start, stop, supported };
}
