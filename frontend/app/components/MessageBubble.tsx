"use client";

import { motion } from "framer-motion";
import { isSinhala } from "../lib/store";
import type { ChatMessage } from "../lib/types";
import { KaviAvatar, TypingDots } from "./KaviAvatar";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const sinhala = isSinhala(message.content);
  const showTyping = message.streaming && message.content.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {!isUser && <KaviAvatar size={30} />}
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed shadow-sm ${
          isUser
            ? "rounded-tr-sm bg-teal text-white"
            : "rounded-tl-sm border border-line bg-card text-ink"
        } ${sinhala ? "sinhala" : ""}`}
      >
        {showTyping ? (
          <TypingDots />
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}
      </div>
    </motion.div>
  );
}
