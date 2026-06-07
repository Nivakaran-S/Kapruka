"use client";

export function KapiAvatar({ size = 40, bob = false }: { size?: number; bob?: boolean }) {
  return (
    <div
      className={`relative flex items-center justify-center rounded-full shadow-sm ${bob ? "kapi-bob" : ""}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        background: "linear-gradient(145deg, var(--color-teal-light), var(--color-teal-dark))",
        border: "1.5px solid rgba(255,255,255,0.6)",
      }}
      aria-hidden
    >
      <span style={{ fontSize: size * 0.52, lineHeight: 1 }}>🐵</span>
      <span
        className="absolute -bottom-0.5 -right-0.5 rounded-full"
        style={{
          width: size * 0.28,
          height: size * 0.28,
          background: "var(--color-gold-light)",
          border: "2px solid var(--color-cream)",
        }}
      />
    </div>
  );
}

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Kapi is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="kapi-dot inline-block h-1.5 w-1.5 rounded-full bg-teal"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}
