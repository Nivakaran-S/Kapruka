"use client";

import { AnimatePresence, motion } from "framer-motion";
import { formatLKR, useKavi } from "../lib/store";
import { CartIcon, CloseIcon, MinusIcon, PlusIcon } from "./icons";

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='100%' height='100%' fill='%23f4ecdc'/><text x='50%' y='50%' font-size='28' text-anchor='middle' dy='.35em'>🎁</text></svg>`
  );

export function CartSidebar() {
  const { state, setCartOpen, removeFromCart, setQty, cartTotal, cartCount, send } = useKavi();

  function checkout() {
    setCartOpen(false);
    send(
      "I'd like to checkout the items in my cart — please help me complete the order (you have my cart)."
    );
  }

  return (
    <AnimatePresence>
      {state.cartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartOpen(false)}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="glass-strong fixed right-0 top-0 z-50 flex h-full w-[88vw] max-w-md flex-col shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <h2 className="text-[16px] font-semibold text-ink">
                Your cart {cartCount > 0 && <span className="text-muted">· {cartCount}</span>}
              </h2>
              <button onClick={() => setCartOpen(false)} aria-label="Close cart" className="rounded-lg p-1.5 text-muted transition hover:bg-cream-soft">
                <CloseIcon size={18} />
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {state.cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-muted">
                  <CartIcon size={40} />
                  <p className="mt-3 text-[14px]">Your cart is empty.</p>
                  <p className="text-[12.5px]">Ask Kavi for gift ideas and tap “Add to cart”.</p>
                </div>
              ) : (
                state.cart.map((item) => (
                  <div key={item.product_id} className="flex gap-3 rounded-2xl border border-line bg-card p-3 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image_url || PLACEHOLDER}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    />
                    <div className="flex flex-1 flex-col">
                      <h3 className="line-clamp-2 text-[13px] font-medium text-ink">{item.name}</h3>
                      <span className="mt-0.5 text-[13.5px] font-semibold text-teal-dark">
                        {formatLKR(item.price, item.currency)}
                      </span>
                      <div className="mt-auto flex items-center gap-2 pt-1.5">
                        <Stepper
                          value={item.quantity}
                          onDec={() => setQty(item.product_id, item.quantity - 1)}
                          onInc={() => setQty(item.product_id, item.quantity + 1)}
                        />
                        <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="ml-auto text-[12px] text-muted hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {state.cart.length > 0 && (
              <footer className="border-t border-line bg-card p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-[14px] text-muted">Subtotal</span>
                  <span className="text-xl font-semibold text-teal-dark">{formatLKR(cartTotal)}</span>
                </div>
                <button
                  onClick={checkout}
                  className="w-full rounded-2xl bg-teal px-5 py-3.5 text-[15px] font-semibold text-white shadow-md transition hover:bg-teal-dark"
                >
                  Checkout with Kavi →
                </button>
                <p className="mt-2 text-center text-[11.5px] text-muted">Kavi will sort out delivery &amp; payment</p>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Stepper({ value, onDec, onInc }: { value: number; onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex items-center rounded-lg border border-line">
      <button onClick={onDec} className="grid h-7 w-7 place-items-center text-muted transition hover:text-ink" aria-label="Decrease quantity">
        <MinusIcon size={15} />
      </button>
      <span className="min-w-6 text-center text-[13px] font-medium text-ink">{value}</span>
      <button onClick={onInc} className="grid h-7 w-7 place-items-center text-muted transition hover:text-ink" aria-label="Increase quantity">
        <PlusIcon size={15} />
      </button>
    </div>
  );
}
