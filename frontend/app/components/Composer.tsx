"use client";

import { useEffect, useRef, useState } from "react";
import { useKapi } from "../lib/store";
import { MicIcon, SendIcon } from "./icons";

// Minimal typings for the Web Speech API (not in lib.dom by default).
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export function Composer() {
  const { send, state } = useKapi();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  // Resolved after mount so SSR and first client render match (avoids hydration mismatch).
  const [hasVoice, setHasVoice] = useState(false);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const busy = state.status === "thinking" || state.status === "streaming";

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recogRef.current = r;
    setHasVoice(true);
  }, []);

  function autosize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }

  function submit() {
    if (!text.trim() || busy) return;
    send(text);
    setText("");
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
    });
  }

  function toggleMic() {
    const r = recogRef.current;
    if (!r) return;
    if (listening) {
      r.stop();
      setListening(false);
    } else {
      try {
        r.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  }

  return (
    <div className="glass border-t border-line px-3 py-3">
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-card p-1.5 shadow-sm focus-within:border-teal-light">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            autosize();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Ask Kapi for a gift…  (English · සිංහල · Tanglish)"
          className="max-h-[140px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[14px] text-ink outline-none placeholder:text-muted"
        />
        {hasVoice && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label="Voice input"
            title="Voice input"
            className={`grid h-9 w-9 place-items-center rounded-xl transition ${
              listening ? "bg-gold-light text-ink" : "text-muted hover:bg-cream-soft"
            }`}
          >
            <MicIcon size={18} active={listening} />
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || busy}
          aria-label="Send"
          className="grid h-9 w-9 place-items-center rounded-xl bg-teal text-white transition hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendIcon size={18} />
        </button>
      </div>
      {listening && (
        <p className="mt-1.5 flex items-center gap-1.5 px-2 text-xs text-teal">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" /> Listening… speak now
        </p>
      )}
    </div>
  );
}
