"use client";

import { useState } from "react";
import { CartSidebar } from "./components/CartSidebar";
import { ChatPanel } from "./components/ChatPanel";
import { GalleryPanel } from "./components/GalleryPanel";
import { CartIcon, ChatIcon, GalleryIcon } from "./components/icons";
import { KaviProvider, useKavi } from "./lib/store";

export default function Home() {
  return (
    <KaviProvider>
      <Shell />
      <CartSidebar />
    </KaviProvider>
  );
}

function Shell() {
  const [mobileTab, setMobileTab] = useState<"chat" | "gallery">("chat");

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Mobile tab switch */}
      <div className="glass flex items-center gap-2 border-b border-line px-3 py-2 md:hidden">
        <TabButton active={mobileTab === "chat"} onClick={() => setMobileTab("chat")}>
          <ChatIcon size={16} /> Chat
        </TabButton>
        <TabButton active={mobileTab === "gallery"} onClick={() => setMobileTab("gallery")}>
          <GalleryIcon size={16} /> Gallery
        </TabButton>
        <CartButton className="ml-auto" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Chat — 40% on desktop */}
        <section
          className={`min-h-0 w-full border-r border-line md:block md:w-2/5 ${
            mobileTab === "chat" ? "block" : "hidden"
          }`}
        >
          <ChatPanel />
        </section>

        {/* Gallery — 60% on desktop */}
        <section
          className={`relative min-h-0 w-full md:block md:w-3/5 ${
            mobileTab === "gallery" ? "block" : "hidden"
          }`}
        >
          <CartButton className="absolute right-5 top-5 z-20 hidden md:flex" />
          <GalleryPanel />
        </section>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
        active ? "bg-teal text-white" : "bg-cream-soft text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function CartButton({ className = "" }: { className?: string }) {
  const { cartCount, setCartOpen } = useKavi();
  return (
    <button
      onClick={() => setCartOpen(true)}
      aria-label={`Open cart${cartCount > 0 ? `, ${cartCount} item${cartCount === 1 ? "" : "s"}` : ""}`}
      className={`glass relative items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-medium text-ink shadow-sm transition hover:bg-cream-soft ${className} flex`}
    >
      <CartIcon size={17} /> Cart
      {cartCount > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-teal px-1 text-[11px] font-semibold text-white">
          {cartCount}
        </span>
      )}
    </button>
  );
}
