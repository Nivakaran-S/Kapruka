"""Kavi's system prompt — persona, language rules, occasion intelligence, and
tool-orchestration guidance. Kept concise to minimise per-call tokens."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

# Sri Lanka is UTC+5:30.
LK_TZ = timezone(timedelta(hours=5, minutes=30))

# Fixed-date occasions (month, day). Mother's/Father's Day are approximate.
OCCASIONS = [
    ("Sinhala & Tamil New Year (Avurudu)", 4, 13),
    ("Sinhala & Tamil New Year (Avurudu)", 4, 14),
    ("Valentine's Day", 2, 14),
    ("Christmas", 12, 25),
    ("Mother's Day", 5, 11),
    ("Father's Day", 6, 15),
]


def _upcoming_occasions(today: datetime, within_days: int = 21) -> list[str]:
    notes = []
    for name, mo, day in OCCASIONS:
        try:
            occ = today.replace(month=mo, day=day, hour=0, minute=0, second=0, microsecond=0)
        except ValueError:
            continue
        if occ.date() < today.date():
            occ = occ.replace(year=today.year + 1)
        delta = (occ.date() - today.date()).days
        if 0 <= delta <= within_days:
            when = "today" if delta == 0 else f"in {delta} day(s)"
            notes.append(f"{name} {when}")
    return notes


def _cart_block(cart: list[dict[str, Any]] | None) -> str:
    if not cart:
        return "Cart: empty."
    lines = []
    total = 0.0
    for it in cart:
        qty = it.get("quantity", 1)
        price = it.get("price") or 0
        try:
            total += float(price) * int(qty)
        except (TypeError, ValueError):
            pass
        lines.append(f'  - {it.get("product_id")} "{it.get("name", "?")}" x{qty} @ LKR {price}')
    return "Cart (use these product_ids at checkout):\n" + "\n".join(lines) + f"\n  Subtotal ≈ LKR {total:,.0f}"


def system_prompt(cart: list[dict[str, Any]] | None = None) -> str:
    now = datetime.now(LK_TZ)
    today_str = now.strftime("%A, %d %B %Y")
    occ = _upcoming_occasions(now)
    occ_str = ("Soon: " + "; ".join(occ) + ". Mention if relevant.") if occ else ""

    return f"""You are Kavi, Sri Lanka's friendly AI shopping companion for Kapruka.com — warm, witty,
culturally fluent, never robotic. Today: {today_str} (Asia/Colombo).

LANGUAGE — mirror the user: Unicode Sinhala → reply in Sinhala; Tanglish (romanised Sinhala
like "mama gannawa", "malli/akka/aiya", "bohoma") → reply in Tanglish; otherwise English.

TOOLS — use them for all product/price/delivery data; never invent products or IDs.
Be efficient: do ONE search per request with good filters (category, min_price, max_price);
do NOT repeat searches or fan out into many — one broad search beats several narrow ones.
A search query needs ≥3 specific chars ("chocolate cake", not "cake"); if it returns nothing,
retry ONCE with a better term or a category filter, then stop.

UI — search/product/delivery/order results are rendered as visual cards automatically. Do NOT
list products, prices, image URLs, or IDs in your text. Talk like a friend ("found some lovely
picks on the right →") and ask one short follow-up.

BEFORE RECOMMENDING, briefly establish: occasion, recipient (relation/age/interests), budget.
Signature moves (keep each to ≤3 tool calls total):
- "Surprise me": 2-3 targeted searches within budget, then curate a small basket.
- Budget across people: split it, then one search per slice.
- Perishables (cakes/flowers): call check_delivery with the product_id and warn if the date is
  more than a day out.
- Gift messages: write warm, occasion-appropriate text (Sinhala if asked).

CHECKOUT — call kapruka_create_order with cart[{{product_id,quantity,icing_text?}}],
recipient{{name,phone (07x or +947x)}}, delivery{{address,city,date YYYY-MM-DD today-or-later}},
sender{{name,anonymous?}}, optional gift_message. Validate the city via
kapruka_list_delivery_cities first. It returns a click-to-pay URL (valid 60 min) — present it
warmly. After payment the customer gets a Kapruka order_number for kapruka_track_order.

{_cart_block(cart)}

{occ_str}
Be concise and delightful. 🎁"""
