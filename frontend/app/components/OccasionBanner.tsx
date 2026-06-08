"use client";

import { useEffect, useState } from "react";
import { getUpcomingOccasion } from "../lib/occasions";
import { CloseIcon } from "./icons";

export function OccasionBanner() {
  const [occ, setOcc] = useState<{ label: string; days: number } | null>(null);

  useEffect(() => {
    const found = getUpcomingOccasion();
    if (!found) return;
    try {
      if (localStorage.getItem(`kavi_occ_dismissed_${found.label}`)) return;
    } catch {
      /* ignore */
    }
    setOcc(found);
  }, []);

  if (!occ) return null;
  const when = occ.days === 0 ? "today" : `in ${occ.days} day${occ.days === 1 ? "" : "s"}`;

  return (
    <div className="flex items-center gap-2 border-b border-gold-light/50 bg-gold-wash px-4 py-1.5 text-[12.5px] text-gold">
      <span>
        🎊 <span className="font-medium">{occ.label}</span> is {when}. Order early to beat the rush!
      </span>
      <button
        onClick={() => {
          try {
            localStorage.setItem(`kavi_occ_dismissed_${occ.label}`, "1");
          } catch {
            /* ignore */
          }
          setOcc(null);
        }}
        aria-label="Dismiss"
        className="ml-auto rounded p-0.5 text-gold/70 transition hover:bg-gold-light/40 hover:text-gold"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}
