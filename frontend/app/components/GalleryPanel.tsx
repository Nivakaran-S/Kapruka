"use client";

import { AnimatePresence, motion } from "framer-motion";
import { formatLKR, useKavi } from "../lib/store";
import type {
  Category,
  DeliveryCheck,
  DeliveryCity,
  OrderResult,
  ProductDetail,
  SearchProduct,
  TrackResult,
} from "../lib/types";
import { KaviAvatar } from "./KaviAvatar";
import { CheckIcon, ExternalIcon, SearchIcon } from "./icons";
import { ProductCard } from "./ProductCard";

export function GalleryPanel() {
  const { state } = useKavi();
  const g = state.gallery;

  return (
    <div className="h-full overflow-y-auto px-5 py-5 md:px-7 md:py-7">
      <AnimatePresence mode="wait">
        <motion.div
          key={g.kind + (g.kind === "products" ? (g.query ?? "") : "")}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {g.kind === "welcome" && <Welcome />}
          {g.kind === "loading" && <LoadingGrid label={g.label} />}
          {g.kind === "products" && <Products products={g.products} query={g.query} />}
          {g.kind === "product" && <Hero product={g.product} />}
          {g.kind === "categories" && <Categories categories={g.categories} />}
          {g.kind === "cities" && <Cities cities={g.cities} />}
          {g.kind === "delivery" && <Delivery delivery={g.delivery} />}
          {g.kind === "order" && <Order order={g.order} />}
          {g.kind === "tracking" && <Tracking tracking={g.tracking} />}
          {g.kind === "empty" && <Empty message={g.message} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-ink">{children}</h2>
      {sub && <p className="text-[13px] text-muted">{sub}</p>}
    </div>
  );
}

function Welcome() {
  return (
    <div className="flex h-[70vh] flex-col items-center justify-center text-center">
      <KaviAvatar size={84} bob />
      <h2 className="mt-5 text-2xl font-semibold text-ink">Your gift gallery</h2>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted">
        As we chat, the perfect picks appear here — beautiful cards, prices in LKR, delivery
        checks, and a one-tap secure checkout. Start by telling Kavi who you&apos;re shopping for. 🎁
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {["🎂 Cakes", "💐 Flowers", "🍫 Chocolates", "🫖 Ceylon Tea", "💎 Jewellery"].map((t) => (
          <span key={t} className="rounded-full border border-line bg-card px-3 py-1.5 text-[12.5px] text-muted shadow-sm">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function LoadingGrid({ label }: { label: string }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-[14px] font-medium text-teal-dark">
        <span className="kavi-dot inline-block h-2 w-2 rounded-full bg-teal-light" />
        {label}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="kavi-skeleton aspect-square w-full" />
            <div className="space-y-2 p-3">
              <div className="kavi-skeleton h-3 w-4/5 rounded" />
              <div className="kavi-skeleton h-3 w-2/5 rounded" />
              <div className="kavi-skeleton h-8 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Products({ products, query }: { products: SearchProduct[]; query?: string }) {
  return (
    <div>
      <SectionTitle sub={`${products.length} pick${products.length === 1 ? "" : "s"} for you`}>
        {query ? `Results for “${query}”` : "Handpicked for you"}
      </SectionTitle>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

function Hero({ product }: { product: ProductDetail }) {
  const { addToCart } = useKavi();
  const img = product.images?.[0];
  const price = product.price?.amount ?? null;
  return (
    <div>
      <SectionTitle>{product.name}</SectionTitle>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-line bg-cream-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img || ""}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="aspect-square w-full object-cover"
          />
          {product.images && product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-2 no-scrollbar">
              {product.images.slice(0, 5).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" referrerPolicy="no-referrer" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-teal-dark">
              {price != null ? formatLKR(price, product.price.currency) : "Price on request"}
            </span>
            {product.in_stock ? (
              <span className="rounded-full bg-teal-wash px-2.5 py-1 text-[12px] font-medium text-teal-dark">In stock</span>
            ) : (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-[12px] font-medium text-red-700">Out of stock</span>
            )}
          </div>
          {product.description && (
            <p className="mt-3 line-clamp-6 text-[13.5px] leading-relaxed text-muted">{product.description}</p>
          )}
          <div className="mt-auto flex gap-2 pt-5">
            <button
              onClick={() =>
                price != null &&
                addToCart({
                  product_id: product.id,
                  name: product.name,
                  price,
                  currency: product.price.currency || "LKR",
                  image_url: img,
                  quantity: 1,
                })
              }
              disabled={price == null || !product.in_stock}
              className="flex-1 rounded-xl bg-teal px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-teal-dark disabled:opacity-40"
            >
              Add to cart
            </button>
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-4 py-2.5 text-[14px] font-medium text-ink transition hover:bg-cream-soft"
            >
              View on Kapruka <ExternalIcon size={15} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Categories({ categories }: { categories: Category[] }) {
  return (
    <div>
      <SectionTitle sub="Tap a category and tell Kavi what you're after">Browse categories</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <a
            key={c.name}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line bg-card px-3.5 py-2 text-[13px] capitalize text-ink shadow-sm transition hover:border-teal-light hover:bg-teal-wash"
          >
            {c.name}
          </a>
        ))}
      </div>
    </div>
  );
}

function Cities({ cities }: { cities: DeliveryCity[] }) {
  return (
    <div>
      <SectionTitle sub="Kapruka delivers to these areas">Delivery cities</SectionTitle>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cities.map((c) => (
          <div key={c.name} className="rounded-xl border border-line bg-card px-3 py-2.5 shadow-sm">
            <div className="text-[14px] font-medium text-ink">{c.name}</div>
            {c.aliases && c.aliases.length > 0 && (
              <div className="truncate text-[11.5px] text-muted">{c.aliases.join(", ")}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Delivery({ delivery }: { delivery: DeliveryCheck }) {
  return (
    <div>
      <SectionTitle>Delivery check</SectionTitle>
      <div className="max-w-md card-premium rounded-2xl border border-line p-5">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-medium text-ink">{delivery.city}</span>
          {delivery.available ? (
            <span className="rounded-full bg-teal-wash px-3 py-1 text-[12px] font-medium text-teal-dark">Available ✓</span>
          ) : (
            <span className="rounded-full bg-red-100 px-3 py-1 text-[12px] font-medium text-red-700">Not available</span>
          )}
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-[13px] text-muted">Delivery date</span>
          <span className="text-[14px] font-medium text-ink">{delivery.checked_date}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-[13px] text-muted">Flat delivery rate</span>
          <span className="text-[15px] font-semibold text-teal-dark">{formatLKR(delivery.rate, delivery.currency)}</span>
        </div>
        {delivery.next_available_date && (
          <p className="mt-3 rounded-lg bg-gold-wash px-3 py-2 text-[12.5px] text-gold">
            Next available: {delivery.next_available_date}
            {delivery.reason ? ` — ${delivery.reason}` : ""}
          </p>
        )}
        {delivery.perishable_warning && (
          <p className="mt-2 rounded-lg bg-gold-wash px-3 py-2 text-[12.5px] text-gold">⚠️ {delivery.perishable_warning}</p>
        )}
      </div>
    </div>
  );
}

function Order({ order }: { order: OrderResult }) {
  const s = order.summary;
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
        <div className="grid h-16 w-16 place-items-center rounded-full bg-teal text-white shadow">
          <CheckIcon size={32} />
        </div>
      </motion.div>
      <h2 className="mt-4 text-xl font-semibold text-ink">Your order is ready to pay</h2>
      <p className="mt-1 text-[13px] text-muted">Ref {order.order_ref}</p>

      <div className="card-premium mt-5 w-full max-w-sm rounded-2xl border border-line p-5 text-left">
        <Row label="Items" value={formatLKR(s.items_total, s.currency)} />
        <Row label="Delivery" value={formatLKR(s.delivery_fee, s.currency)} />
        {s.addons_total > 0 && <Row label="Add-ons" value={formatLKR(s.addons_total, s.currency)} />}
        <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-[14px] font-medium text-ink">Total</span>
          <span className="text-xl font-semibold text-teal-dark">{formatLKR(s.grand_total, s.currency)}</span>
        </div>
      </div>

      <a
        href={order.checkout_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 w-full max-w-sm rounded-2xl bg-teal px-5 py-3.5 text-[15px] font-semibold text-white shadow-md transition hover:bg-teal-dark"
      >
        Open secure checkout →
      </a>
      <p className="mt-2 text-[11.5px] text-muted">Prices locked · link expires {new Date(order.expires_at).toLocaleTimeString()}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[13.5px] text-ink">{value}</span>
    </div>
  );
}

function Tracking({ tracking }: { tracking: TrackResult }) {
  return (
    <div>
      <SectionTitle sub={`Order ${tracking.order_number}`}>Order tracking</SectionTitle>
      <div className="max-w-lg card-premium rounded-2xl border border-line p-5">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-teal-wash px-3 py-1 text-[13px] font-medium text-teal-dark capitalize">
            {tracking.status_display || tracking.status}
          </span>
          {tracking.amount && <span className="text-[14px] font-semibold text-teal-dark">LKR {tracking.amount}</span>}
        </div>

        {tracking.progress && tracking.progress.length > 0 && (
          <ol className="mt-5 space-y-0">
            {tracking.progress.map((p, i) => (
              <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-teal-light" />
                  {i < tracking.progress!.length - 1 && <span className="my-0.5 w-px flex-1 bg-line" />}
                </div>
                <div className="pb-4">
                  <div className="text-[13.5px] font-medium text-ink capitalize">{p.step}</div>
                  <div className="text-[12px] text-muted">{p.timestamp}</div>
                </div>
              </li>
            ))}
          </ol>
        )}

        {tracking.recipient && (
          <div className="mt-3 border-t border-line pt-3 text-[13px] text-muted">
            To <span className="text-ink">{tracking.recipient.name}</span>, {tracking.recipient.city}
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center text-center text-muted">
      <SearchIcon size={44} />
      <p className="mt-4 max-w-sm text-[14px]">{message}</p>
    </div>
  );
}
