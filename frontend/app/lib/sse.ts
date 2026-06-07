import type { AgentEvent, CartItem, ChatMessage } from "./types";

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "http://localhost:7860";

interface StreamArgs {
  messages: Array<Pick<ChatMessage, "role" | "content">>;
  cart: CartItem[];
  threadId: string;
  signal?: AbortSignal;
  onEvent: (event: AgentEvent) => void;
}

/**
 * POST the conversation to the backend and parse the Server-Sent Events stream,
 * invoking onEvent for each parsed event. Resolves when the stream ends.
 * threadId keys the backend's LangGraph memory so the agent remembers the
 * conversation (and the products it showed) across turns.
 */
export async function streamChat({ messages, cart, threadId, signal, onEvent }: StreamArgs): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, cart, thread_id: threadId }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Backend error: ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLines = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
      if (dataLines.length === 0) continue; // comment/keepalive frame
      const payload = dataLines.join("\n");
      try {
        onEvent(JSON.parse(payload) as AgentEvent);
      } catch {
        // ignore malformed frame
      }
    }
  }
}
