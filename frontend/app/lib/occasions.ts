// Client-side occasion calendar (mirrors the backend) for the proactive banner.
const OCCASIONS: Array<[string, number, number]> = [
  ["Avurudu (Sinhala & Tamil New Year)", 4, 14],
  ["Valentine's Day", 2, 14],
  ["Christmas", 12, 25],
  ["Mother's Day", 5, 11],
  ["Father's Day", 6, 15],
  ["Deepavali", 11, 1],
];

export function getUpcomingOccasion(withinDays = 21): { label: string; days: number } | null {
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let best: { label: string; days: number } | null = null;
  for (const [label, mo, day] of OCCASIONS) {
    let occ = new Date(now.getFullYear(), mo - 1, day);
    if (occ < todayMid) occ = new Date(now.getFullYear() + 1, mo - 1, day);
    const days = Math.round((occ.getTime() - todayMid.getTime()) / 86_400_000);
    if (days >= 0 && days <= withinDays && (!best || days < best.days)) {
      best = { label, days };
    }
  }
  return best;
}
