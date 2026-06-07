// Types mirroring the Kapruka MCP JSON responses (captured from the live server)
// and the SSE event protocol emitted by the Kavi backend.

export interface Price {
  amount: number | null;
  currency: string;
}

export interface SearchProduct {
  id: string;
  name: string;
  summary?: string;
  price: Price;
  compare_at_price?: Price | null;
  in_stock: boolean;
  stock_level?: string;
  image_url?: string | null;
  category?: { id: string; name: string; slug: string };
  ships_internationally?: boolean;
  url: string;
}

export interface SearchResponse {
  results: SearchProduct[];
  next_cursor?: string | null;
  applied_filters?: Record<string, unknown>;
}

export interface ProductDetail {
  id: string;
  name: string;
  description?: string;
  summary?: string;
  price: Price;
  compare_at_price?: Price | null;
  in_stock: boolean;
  stock_level?: string;
  category?: { id: string; name: string; slug: string; path?: string };
  variants?: Array<{ id: string; name: string; sku: string; price: Price; in_stock: boolean }>;
  images?: string[];
  attributes?: Record<string, string>;
  shipping?: { ships_from: string; ships_internationally: boolean };
  url: string;
}

export interface Category {
  name: string;
  url: string;
  children?: Category[];
}

export interface DeliveryCity {
  name: string;
  aliases?: string[];
}

export interface DeliveryCheck {
  city: string;
  now?: string;
  checked_date: string;
  available: boolean;
  rate: number;
  currency: string;
  reason?: string | null;
  next_available_date?: string | null;
  perishable_warning?: string | null;
}

export interface OrderResult {
  checkout_url: string;
  order_ref: string;
  summary: {
    items_total: number;
    delivery_fee: number;
    addons_total: number;
    grand_total: number;
    currency: string;
  };
  expires_at: string;
}

export interface TrackResult {
  order_number: string;
  status: string;
  status_display?: string;
  order_date?: string;
  delivery_date?: string;
  amount?: string;
  recipient?: { name: string; phone: string; address: string; city: string };
  greeting_message?: string | null;
  progress?: Array<{ step: string; timestamp: string }>;
  items?: Array<{ product_id: string; name: string; quantity: number; selling_price: number }>;
  has_delivery_photo?: boolean;
}

// ---- chat + cart ----------------------------------------------------------

export type Role = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  streaming?: boolean;
}

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  currency: string;
  image_url?: string | null;
  quantity: number;
}

// ---- SSE events from the backend -----------------------------------------

export type ToolName =
  | "kapruka_search_products"
  | "kapruka_get_product"
  | "kapruka_list_categories"
  | "kapruka_list_delivery_cities"
  | "kapruka_check_delivery"
  | "kapruka_create_order"
  | "kapruka_track_order";

export type AgentEvent =
  | { type: "token"; text: string }
  | { type: "tool_call"; name: ToolName; args: Record<string, unknown> }
  | { type: "tool_result"; tool: ToolName; data: unknown; is_error: boolean }
  | { type: "error"; message: string }
  | { type: "done" };

// ---- what the gallery panel is currently showing --------------------------

export type GalleryView =
  | { kind: "welcome" }
  | { kind: "loading"; label: string }
  | { kind: "products"; products: SearchProduct[]; query?: string }
  | { kind: "product"; product: ProductDetail }
  | { kind: "categories"; categories: Category[] }
  | { kind: "cities"; cities: DeliveryCity[] }
  | { kind: "delivery"; delivery: DeliveryCheck }
  | { kind: "order"; order: OrderResult }
  | { kind: "tracking"; tracking: TrackResult }
  | { kind: "empty"; message: string };
