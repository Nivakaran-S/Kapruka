"use client";

import { useEffect, useRef } from "react";
import { useKavi } from "../lib/store";
import { Composer } from "./Composer";
import { KaviAvatar, TypingDots } from "./KaviAvatar";
import { MessageBubble } from "./MessageBubble";
import { SuggestionChips } from "./SuggestionChips";

const SUGGESTIONS = [
  "Birthday gift for my amma under 5000 LKR",
  "Surprise me, 6000 for my akka 🎁",
  "මගේ අයියාට උපන්දිනෙට තෑග්ගක්",
  "Red roses delivered to Kandy",
];

export function ChatPanel() {
  const { state, send, retry } = useKavi();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [state.messages, state.status, state.activity]);

  const empty = state.messages.length === 0;
  const last = state.messages[state.messages.length - 1];
  const showIndicator =
    (state.status === "thinking" || state.status === "streaming") &&
    last?.role === "assistant" &&
    last.content === "";

  return (
    <div className="flex h-full flex-col bg-cream/60">
      {/* header */}
      <header className="glass flex items-center gap-3 border-b border-line px-4 py-3">
        <KaviAvatar size={40} bob />
        <div className="leading-tight">
          <h1 className="text-[17px] font-semibold kavi-wordmark">Kavi</h1>
          <p className="text-xs text-muted">Sri Lanka&apos;s AI shopping companion</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-teal-wash px-2.5 py-1 text-[11px] font-medium text-teal-dark">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-light" /> online
        </span>
      </header>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {empty ? (
          <Welcome onPick={send} />
        ) : (
          state.messages
            .filter((m) => !(m.role === "assistant" && m.streaming && m.content === ""))
            .map((m) => <MessageBubble key={m.id} message={m} />)
        )}

        {showIndicator && (
          <div className="flex items-center gap-2.5">
            <KaviAvatar size={30} />
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-line bg-card px-3.5 py-2.5 text-[13px] text-muted">
              <span>{state.activity ?? "Kavi is thinking"}</span>
              <TypingDots />
            </div>
          </div>
        )}

        {state.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
            <p>{state.error}</p>
            <button
              onClick={retry}
              className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <SuggestionChips />
      <Composer />
    </div>
  );
}

function Welcome({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="mx-auto max-w-md py-6 text-center">
      <div className="mx-auto mb-4 w-fit">
        <KaviAvatar size={64} bob />
      </div>
      <h2 className="text-xl font-semibold text-ink">Ayubowan! I&apos;m Kavi 🙏</h2>
      <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-muted">
        Tell me who you&apos;re shopping for, the occasion, and your budget, and I&apos;ll find the
        perfect gift on Kapruka. Chat in <span className="font-medium text-teal-dark">English</span>,{" "}
        <span className="sinhala font-medium text-teal-dark">සිංහල</span>, or Tanglish.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className={`rounded-xl border border-line bg-card px-3.5 py-2.5 text-left text-[13.5px] text-ink shadow-sm transition hover:border-teal-light hover:bg-teal-wash ${
              /[඀-෿]/.test(s) ? "sinhala" : ""
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
