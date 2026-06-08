"use client";

import { useKavi } from "../lib/store";

/** Context-aware quick replies shown above the composer once a chat is underway. */
export function SuggestionChips() {
  const { state, send, setCheckoutOpen } = useKavi();
  if (state.messages.length === 0) return null;

  const busy = state.status === "thinking" || state.status === "streaming";
  const g = state.gallery.kind;
  const chips: Array<{ label: string; onClick: () => void }> = [];

  if (state.cart.length > 0) {
    chips.push({ label: "🛒 Checkout", onClick: () => setCheckoutOpen(true) });
  }
  if (g === "products" || g === "product") {
    chips.push({ label: "Cheaper options", onClick: () => send("Show me cheaper options.") });
    chips.push({ label: "Check delivery", onClick: () => send("Can you check delivery for this?") });
  }
  chips.push({ label: "✨ Surprise me", onClick: () => send("Surprise me with a gift idea within my budget.") });
  chips.push({ label: "✍️ Gift message", onClick: () => send("Help me write a short, warm gift message.") });

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pb-1.5">
      {chips.map((c) => (
        <button
          key={c.label}
          disabled={busy}
          onClick={c.onClick}
          className="rounded-full border border-line bg-card px-3 py-1.5 text-[12.5px] font-medium text-teal-dark shadow-sm transition hover:border-teal-light hover:bg-teal-wash disabled:cursor-not-allowed disabled:opacity-40"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
