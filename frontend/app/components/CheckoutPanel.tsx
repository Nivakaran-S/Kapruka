"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "../lib/sse";
import { formatLKR, useKavi } from "../lib/store";
import { CloseIcon } from "./icons";

interface City {
  name: string;
  aliases?: string[];
}

export function CheckoutPanel() {
  const { state, setCheckoutOpen, cartCount, cartTotal, send } = useKavi();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [sender, setSender] = useState("");
  const [anon, setAnon] = useState(false);
  const [giftMsg, setGiftMsg] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [showCities, setShowCities] = useState(false);
  const debounce = useRef<number | undefined>(undefined);
  const cityPicked = useRef(false);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (cityPicked.current) {
      cityPicked.current = false;
      return;
    }
    if (city.trim().length < 2) {
      setCities([]);
      return;
    }
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/cities?q=${encodeURIComponent(city.trim())}`);
        const d = await r.json();
        setCities(d.cities ?? []);
        setShowCities(true);
      } catch {
        setCities([]);
      }
    }, 250);
    return () => window.clearTimeout(debounce.current);
  }, [city]);

  const valid =
    !!(name.trim() && phone.trim() && address.trim() && city.trim() && date && sender.trim()) &&
    state.cart.length > 0;

  function submit() {
    if (!valid) return;
    const parts = [
      "Please place my order now using the items in my cart.",
      `Recipient: ${name.trim()}, phone ${phone.trim()}.`,
      `Deliver to: ${address.trim()}, ${city.trim()}, on ${date}.`,
      `Sender: ${anon ? "Anonymous" : sender.trim()}.`,
    ];
    if (giftMsg.trim()) parts.push(`Gift message: "${giftMsg.trim()}".`);
    setCheckoutOpen(false);
    send(parts.join(" "));
  }

  return (
    <AnimatePresence>
      {state.checkoutOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCheckoutOpen(false)}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="glass-strong fixed right-0 top-0 z-50 flex h-full w-[92vw] max-w-md flex-col shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <div>
                <h2 className="text-[16px] font-semibold text-ink">Checkout</h2>
                <p className="text-[12px] text-muted">
                  {cartCount} item{cartCount === 1 ? "" : "s"} · {formatLKR(cartTotal)}
                </p>
              </div>
              <button
                onClick={() => setCheckoutOpen(false)}
                aria-label="Close checkout"
                className="rounded-lg p-1.5 text-muted transition hover:bg-cream-soft"
              >
                <CloseIcon size={18} />
              </button>
            </header>

            <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
              <Section title="Recipient">
                <Field label="Name" value={name} onChange={setName} placeholder="Who's it for?" />
                <Field label="Phone" value={phone} onChange={setPhone} placeholder="0771234567" type="tel" />
              </Section>

              <Section title="Delivery">
                <Field label="Address" value={address} onChange={setAddress} placeholder="Street, area" />
                <div className="relative">
                  <Field
                    label="City"
                    value={city}
                    onChange={setCity}
                    placeholder="Start typing… e.g. Colombo"
                    onFocus={() => cities.length && setShowCities(true)}
                  />
                  {showCities && cities.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-line bg-card shadow-lg">
                      {cities.map((c) => (
                        <button
                          key={c.name}
                          onClick={() => {
                            cityPicked.current = true;
                            setCity(c.name);
                            setShowCities(false);
                          }}
                          className="block w-full px-3 py-2 text-left text-[13px] text-ink transition hover:bg-teal-wash"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-muted">Delivery date</span>
                  <input
                    type="date"
                    min={today}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none focus:border-teal-light"
                  />
                </label>
              </Section>

              <Section title="From you">
                <Field label="Your name" value={sender} onChange={setSender} placeholder="Sender name" disabled={anon} />
                <label className="flex items-center gap-2 text-[13px] text-muted">
                  <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} className="accent-[var(--color-teal)]" />
                  Send anonymously
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-muted">Gift message (optional)</span>
                  <textarea
                    value={giftMsg}
                    onChange={(e) => setGiftMsg(e.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder="A few warm words…"
                    className="w-full resize-none rounded-xl border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none focus:border-teal-light"
                  />
                </label>
              </Section>
            </div>

            <footer className="border-t border-line bg-card p-4">
              <button
                onClick={submit}
                disabled={!valid}
                className="w-full rounded-2xl bg-teal px-5 py-3.5 text-[15px] font-semibold text-white shadow-md transition hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                Place order with Kavi →
              </button>
              <p className="mt-2 text-center text-[11.5px] text-muted">
                Kavi validates delivery &amp; returns a secure pay link 🔒
              </p>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-line bg-card/60 p-3">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  onFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  onFocus?: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-muted">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none transition focus:border-teal-light disabled:opacity-50 placeholder:text-muted"
      />
    </label>
  );
}
