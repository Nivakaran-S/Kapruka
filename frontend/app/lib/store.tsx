"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { streamChat } from "./sse";
import type {
  AgentEvent,
  CartItem,
  ChatMessage,
  GalleryView,
  SearchProduct,
  ToolName,
} from "./types";

type Status = "idle" | "thinking" | "streaming" | "error";

interface State {
  messages: ChatMessage[];
  cart: CartItem[];
  cartOpen: boolean;
  checkoutOpen: boolean;
  gallery: GalleryView;
  status: Status;
  error: string | null;
  activity: string | null; // e.g. "Searching the catalogue…" while a tool runs
  galleryUnseen: boolean; // for the mobile gallery-tab badge
}

const initialState: State = {
  messages: [],
  cart: [],
  cartOpen: false,
  checkoutOpen: false,
  gallery: { kind: "welcome" },
  status: "idle",
  error: null,
  activity: null,
  galleryUnseen: false,
};

const STORAGE_KEY = "kavi_state_v1";

type Action =
  | { t: "hydrate"; messages: ChatMessage[]; cart: CartItem[] }
  | { t: "user_msg"; id: string; text: string }
  | { t: "drop_last_assistant" }
  | { t: "start_assistant"; id: string }
  | { t: "token"; id: string; text: string }
  | { t: "finish_assistant"; id: string }
  | { t: "status"; status: Status }
  | { t: "activity"; label: string | null }
  | { t: "error"; message: string }
  | { t: "gallery"; view: GalleryView }
  | { t: "gallery_seen" }
  | { t: "add_to_cart"; item: CartItem }
  | { t: "remove_from_cart"; product_id: string }
  | { t: "set_qty"; product_id: string; quantity: number }
  | { t: "clear_cart" }
  | { t: "cart_open"; open: boolean }
  | { t: "checkout_open"; open: boolean };

const MEANINGFUL_GALLERY = new Set([
  "products",
  "product",
  "order",
  "tracking",
  "delivery",
  "cities",
  "categories",
]);

function reducer(state: State, a: Action): State {
  switch (a.t) {
    case "hydrate":
      return { ...state, messages: a.messages, cart: a.cart };
    case "user_msg":
      return {
        ...state,
        messages: [...state.messages, { id: a.id, role: "user", content: a.text }],
      };
    case "drop_last_assistant": {
      const msgs = [...state.messages];
      if (msgs.length && msgs[msgs.length - 1].role === "assistant") msgs.pop();
      return { ...state, messages: msgs, error: null, status: "idle" };
    }
    case "start_assistant":
      return {
        ...state,
        error: null,
        messages: [
          ...state.messages,
          { id: a.id, role: "assistant", content: "", streaming: true },
        ],
      };
    case "token":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === a.id ? { ...m, content: m.content + a.text } : m
        ),
      };
    case "finish_assistant":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === a.id ? { ...m, streaming: false } : m
        ),
      };
    case "status":
      return { ...state, status: a.status };
    case "activity":
      return { ...state, activity: a.label };
    case "error":
      return { ...state, status: "error", error: a.message };
    case "gallery":
      return {
        ...state,
        gallery: a.view,
        galleryUnseen: state.galleryUnseen || MEANINGFUL_GALLERY.has(a.view.kind),
      };
    case "gallery_seen":
      return { ...state, galleryUnseen: false };
    case "add_to_cart": {
      const existing = state.cart.find((c) => c.product_id === a.item.product_id);
      const cart = existing
        ? state.cart.map((c) =>
            c.product_id === a.item.product_id
              ? { ...c, quantity: c.quantity + a.item.quantity }
              : c
          )
        : [...state.cart, a.item];
      return { ...state, cart, cartOpen: true };
    }
    case "remove_from_cart":
      return { ...state, cart: state.cart.filter((c) => c.product_id !== a.product_id) };
    case "set_qty":
      return {
        ...state,
        cart: state.cart
          .map((c) =>
            c.product_id === a.product_id ? { ...c, quantity: Math.max(0, a.quantity) } : c
          )
          .filter((c) => c.quantity > 0),
      };
    case "clear_cart":
      return { ...state, cart: [] };
    case "cart_open":
      return { ...state, cartOpen: a.open };
    case "checkout_open":
      return { ...state, checkoutOpen: a.open, cartOpen: a.open ? false : state.cartOpen };
    default:
      return state;
  }
}

// ---- tool result → gallery view -------------------------------------------

const TOOL_LABEL: Record<ToolName, string> = {
  kapruka_search_products: "Searching the catalogue…",
  kapruka_get_product: "Fetching product details…",
  kapruka_list_categories: "Browsing categories…",
  kapruka_list_delivery_cities: "Finding delivery cities…",
  kapruka_check_delivery: "Checking delivery…",
  kapruka_create_order: "Creating your order…",
  kapruka_track_order: "Tracking your order…",
};

function galleryFromResult(tool: ToolName, data: unknown): GalleryView | null {
  const d = data as Record<string, unknown> | string | null;
  switch (tool) {
    case "kapruka_search_products": {
      if (d && typeof d === "object" && Array.isArray((d as { results?: unknown[] }).results)) {
        const products = (d as { results: SearchProduct[] }).results;
        const query = (d as { applied_filters?: { q?: string } }).applied_filters?.q;
        return products.length
          ? { kind: "products", products, query }
          : { kind: "empty", message: "No products matched that search. Try a more specific term." };
      }
      return { kind: "empty", message: typeof d === "string" ? d : "No products found." };
    }
    case "kapruka_get_product":
      return d && typeof d === "object" && "id" in d
        ? { kind: "product", product: d as never }
        : null;
    case "kapruka_list_categories":
      return d && typeof d === "object" && Array.isArray((d as { categories?: unknown[] }).categories)
        ? { kind: "categories", categories: (d as { categories: never[] }).categories }
        : null;
    case "kapruka_list_delivery_cities":
      return d && typeof d === "object" && Array.isArray((d as { cities?: unknown[] }).cities)
        ? { kind: "cities", cities: (d as { cities: never[] }).cities }
        : null;
    case "kapruka_check_delivery":
      return d && typeof d === "object" && "available" in d
        ? { kind: "delivery", delivery: d as never }
        : null;
    case "kapruka_create_order":
      return d && typeof d === "object" && "checkout_url" in d
        ? { kind: "order", order: d as never }
        : { kind: "empty", message: typeof d === "string" ? d : "Could not create the order." };
    case "kapruka_track_order":
      return d && typeof d === "object" && "status" in d
        ? { kind: "tracking", tracking: d as never }
        : { kind: "empty", message: typeof d === "string" ? d : "Order not found." };
    default:
      return null;
  }
}

// ---- context --------------------------------------------------------------

interface KaviContext {
  state: State;
  send: (text: string) => void;
  retry: () => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;
  setCheckoutOpen: (open: boolean) => void;
  markGallerySeen: () => void;
  cartCount: number;
  cartTotal: number;
}

const Ctx = createContext<KaviContext | null>(null);

export function KaviProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const busy = useRef(false);
  const lastUserText = useRef<string | null>(null);
  const hydrated = useRef(false);
  // Stable per-session id keying the backend's LangGraph conversation memory.
  const threadId = useRef<string>("");
  if (threadId.current === "") threadId.current = crypto.randomUUID();

  // Hydrate from localStorage after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          messages?: ChatMessage[];
          cart?: CartItem[];
          threadId?: string;
        };
        if (saved.threadId) threadId.current = saved.threadId;
        dispatch({
          t: "hydrate",
          messages: (saved.messages ?? []).map((m) => ({ ...m, streaming: false })),
          cart: saved.cart ?? [],
        });
      }
    } catch {
      /* ignore corrupt storage */
    }
    hydrated.current = true;
  }, []);

  // Persist when idle (avoids writing partial streamed messages).
  useEffect(() => {
    if (!hydrated.current) return;
    if (state.status === "streaming" || state.status === "thinking") return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          messages: state.messages.slice(-60),
          cart: state.cart,
          threadId: threadId.current,
        })
      );
    } catch {
      /* quota / unavailable - ignore */
    }
  }, [state.messages, state.cart, state.status]);

  const run = useCallback(
    (outgoing: Array<{ role: "user" | "assistant"; content: string }>, cart: CartItem[]) => {
      busy.current = true;
      const asstId = crypto.randomUUID();
      dispatch({ t: "start_assistant", id: asstId });
      dispatch({ t: "status", status: "thinking" });

      const onEvent = (ev: AgentEvent) => {
        switch (ev.type) {
          case "token":
            dispatch({ t: "activity", label: null });
            dispatch({ t: "status", status: "streaming" });
            dispatch({ t: "token", id: asstId, text: ev.text });
            break;
          case "tool_call":
            dispatch({ t: "activity", label: TOOL_LABEL[ev.name] ?? "Working…" });
            dispatch({ t: "gallery", view: { kind: "loading", label: TOOL_LABEL[ev.name] ?? "Working…" } });
            break;
          case "tool_result": {
            if (ev.is_error) break;
            const view = galleryFromResult(ev.tool, ev.data);
            if (view) dispatch({ t: "gallery", view });
            break;
          }
          case "error":
            dispatch({ t: "error", message: ev.message });
            break;
          case "done":
            break;
        }
      };

      streamChat({ messages: outgoing, cart, threadId: threadId.current, onEvent })
        .catch((err: unknown) => {
          dispatch({
            t: "error",
            message: err instanceof Error ? err.message : "Something went wrong talking to Kavi.",
          });
        })
        .finally(() => {
          dispatch({ t: "finish_assistant", id: asstId });
          dispatch({ t: "activity", label: null });
          dispatch({ t: "status", status: "idle" });
          busy.current = false;
        });
    },
    []
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy.current) return;
      lastUserText.current = trimmed;
      const outgoing = [
        ...state.messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: trimmed },
      ];
      dispatch({ t: "user_msg", id: crypto.randomUUID(), text: trimmed });
      run(outgoing, state.cart);
    },
    [run, state.messages, state.cart]
  );

  const retry = useCallback(() => {
    if (busy.current || !lastUserText.current) return;
    // Drop the failed assistant bubble; re-run with the existing user turn intact.
    const kept = state.messages.filter(
      (m, i) => !(i === state.messages.length - 1 && m.role === "assistant")
    );
    const outgoing = kept.map((m) => ({ role: m.role, content: m.content }));
    dispatch({ t: "drop_last_assistant" });
    run(outgoing, state.cart);
  }, [run, state.messages, state.cart]);

  const value = useMemo<KaviContext>(() => {
    const cartCount = state.cart.reduce((n, c) => n + c.quantity, 0);
    const cartTotal = state.cart.reduce((n, c) => n + c.price * c.quantity, 0);
    return {
      state,
      send,
      retry,
      addToCart: (item) => dispatch({ t: "add_to_cart", item }),
      removeFromCart: (id) => dispatch({ t: "remove_from_cart", product_id: id }),
      setQty: (id, qty) => dispatch({ t: "set_qty", product_id: id, quantity: qty }),
      clearCart: () => dispatch({ t: "clear_cart" }),
      setCartOpen: (open) => dispatch({ t: "cart_open", open }),
      setCheckoutOpen: (open) => dispatch({ t: "checkout_open", open }),
      markGallerySeen: () => dispatch({ t: "gallery_seen" }),
      cartCount,
      cartTotal,
    };
  }, [state, send, retry]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKavi(): KaviContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useKavi must be used within KaviProvider");
  return ctx;
}

export function isSinhala(text: string): boolean {
  return /[඀-෿]/.test(text);
}

export function formatLKR(amount: number, currency = "LKR"): string {
  return `${currency} ${Math.round(amount).toLocaleString("en-LK")}`;
}
