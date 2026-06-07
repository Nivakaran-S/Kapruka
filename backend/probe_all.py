"""Live end-to-end test of ALL 7 Kapruka MCP tools.

Calls each tool against https://mcp.kapruka.com/mcp with the required `params`
wrapper + response_format=json, chaining real IDs/cities between calls.
Writes full outputs to mcp_probe_all.json and prints a concise summary.
"""
import asyncio
import json

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

MCP_URL = "https://mcp.kapruka.com/mcp"
OUT = {}


def parse(result):
    sc = getattr(result, "structuredContent", None)
    if isinstance(sc, dict) and "result" in sc:
        raw = sc["result"]
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except Exception:
                return raw
        return raw
    for c in getattr(result, "content", []) or []:
        if getattr(c, "type", None) == "text":
            try:
                return json.loads(c.text)
            except Exception:
                return c.text
    return None


async def call(session, name, inner):
    inner = {**inner, "response_format": "json"}
    res = await session.call_tool(name, {"params": inner})
    data = parse(res)
    OUT[name + " " + json.dumps({k: v for k, v in inner.items() if k != "response_format"})] = {
        "isError": bool(getattr(res, "isError", False)),
        "data": data,
    }
    return data, bool(getattr(res, "isError", False))


def summarize(title, data, is_err):
    print("\n" + "=" * 70)
    print(f"{title}  ->  {'ERROR' if is_err else 'OK'}")
    print("=" * 70)
    s = json.dumps(data, ensure_ascii=False)
    print(s[:600] + ("…" if len(s) > 600 else ""))


async def main():
    async with streamablehttp_client(MCP_URL) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # 1. list_categories
            d, e = await call(session, "kapruka_list_categories", {"depth": 1})
            cats = len(d.get("categories", [])) if isinstance(d, dict) else "?"
            summarize(f"1. list_categories ({cats} categories)", d, e)

            # 2. search_products
            d, e = await call(session, "kapruka_search_products", {"q": "red roses", "limit": 3})
            results = d.get("results", []) if isinstance(d, dict) else []
            pid = results[0]["id"] if results else None
            summarize(f"2. search_products 'red roses' ({len(results)} hits)", d, e)

            # 3. get_product (using first search hit)
            if pid:
                d, e = await call(session, "kapruka_get_product", {"product_id": pid})
                summarize(f"3. get_product '{pid}'", d, e)

            # 4. list_delivery_cities
            d, e = await call(session, "kapruka_list_delivery_cities", {"query": "Colombo", "limit": 5})
            city = d["cities"][0]["name"] if isinstance(d, dict) and d.get("cities") else "Colombo 03"
            summarize(f"4. list_delivery_cities 'Colombo' (city={city})", d, e)

            # 5. check_delivery (with perishable product_id)
            d, e = await call(
                session,
                "kapruka_check_delivery",
                {"city": city, "delivery_date": "2026-06-20", "product_id": pid or "FLOWERS00T2075"},
            )
            summarize("5. check_delivery", d, e)

            # 6. create_order (guest checkout — returns an UNPAID pay link, no charge)
            if pid:
                d, e = await call(
                    session,
                    "kapruka_create_order",
                    {
                        "cart": [{"product_id": pid, "quantity": 1}],
                        "recipient": {"name": "Test Recipient", "phone": "0771234567"},
                        "delivery": {
                            "address": "123 Test Lane",
                            "city": city,
                            "date": "2026-06-20",
                        },
                        "sender": {"name": "Kavi Test"},
                        "gift_message": "Test order — please ignore.",
                    },
                )
                summarize("6. create_order (unpaid checkout link)", d, e)

            # 7. track_order (no real paid order number — shows the live error path)
            d, e = await call(session, "kapruka_track_order", {"order_number": "VIMP34456CB2"})
            summarize("7. track_order 'VIMP34456CB2' (sample)", d, e)


if __name__ == "__main__":
    asyncio.run(main())
    with open("mcp_probe_all.json", "w", encoding="utf-8") as f:
        json.dump(OUT, f, indent=2, ensure_ascii=False, default=str)
    print("\nWrote mcp_probe_all.json")
