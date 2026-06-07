"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { formatLKR, useKapi } from "../lib/store";
import type { SearchProduct } from "../lib/types";
import { CartIcon, CheckIcon } from "./icons";

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='100%' height='100%' fill='%23f4ecdc'/><text x='50%' y='50%' font-size='40' text-anchor='middle' dy='.35em'>🎁</text></svg>`
  );

export function ProductCard({ product, width }: { product: SearchProduct; width?: number }) {
  const { addToCart } = useKapi();
  const [added, setAdded] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const price = product.price?.amount ?? null;

  function add() {
    if (price == null) return;
    addToCart({
      product_id: product.id,
      name: product.name,
      price,
      currency: product.price.currency || "LKR",
      image_url: product.image_url,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
      className="card-premium flex shrink-0 flex-col overflow-hidden rounded-2xl border border-line"
      style={{ width: width ?? "auto" }}
    >
      <div className="relative aspect-square overflow-hidden bg-cream-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgErr || !product.image_url ? PLACEHOLDER : product.image_url}
          alt={product.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgErr(true)}
          className="h-full w-full object-cover transition duration-300 hover:scale-105"
        />
        {!product.in_stock ? (
          <Badge className="bg-red-100 text-red-700">Out of stock</Badge>
        ) : product.stock_level === "low" ? (
          <Badge className="bg-gold-wash text-gold">Few left</Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-[13.5px] font-medium leading-snug text-ink">
          {product.name}
        </h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[15px] font-semibold text-teal-dark">
            {price != null ? formatLKR(price, product.price.currency) : "Price on request"}
          </span>
          {product.compare_at_price?.amount ? (
            <span className="text-xs text-muted line-through">
              {formatLKR(product.compare_at_price.amount, product.compare_at_price.currency)}
            </span>
          ) : null}
        </div>

        <button
          onClick={add}
          disabled={price == null || !product.in_stock}
          className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
            added ? "bg-teal-dark text-white" : "bg-teal-wash text-teal-dark hover:bg-teal hover:text-white"
          }`}
        >
          {added ? (
            <>
              <CheckIcon size={15} /> Added
            </>
          ) : (
            <>
              <CartIcon size={15} /> Add to cart
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
  );
}
