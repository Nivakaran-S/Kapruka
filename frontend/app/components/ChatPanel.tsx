"use client";

import { useEffect, useRef } from "react";
import { useKapi } from "../lib/store";
import { Composer } from "./Composer";
import { KapiAvatar } from "./KapiAvatar";
import { MessageBubble } from "./MessageBubble";

const SUGGESTIONS = [
  "Birthday gift for my amma under 5000 LKR",
  "Surprise me — 6000 for my akka 🎁",
  "මගේ අයියාට උපන්දිනෙට තෑග්ගක්",
  "Red roses delivered to Kandy",
];

export function ChatPanel() {
  const { state, send } = useKapi();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [state.messages, state.status]);

  const empty = state.messages.length === 0;

  return (
    <div className="flex h-full flex-col bg-cream/60">
      {/* header */}
      <header className="glass flex items-center gap-3 border-b border-line px-4 py-3">
        <KapiAvatar size={40} bob />
        <div className="leading-tight">
          <h1 className="text-[17px] font-semibold kapi-wordmark">Kapi</h1>
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
          state.messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}

        {state.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
            {state.error}
          </div>
        )}
      </div>

      <Composer />
    </div>
  );
}

function Welcome({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="mx-auto max-w-md py-6 text-center">
      <div className="mx-auto mb-4 w-fit">
        <KapiAvatar size={64} bob />
      </div>
      <h2 className="text-xl font-semibold text-ink">Ayubowan! I&apos;m Kapi 🙏</h2>
      <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-muted">
        Tell me who you&apos;re shopping for, the occasion, and your budget — I&apos;ll find the
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
