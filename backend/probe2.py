"""Probe real product shapes: search that returns hits, then get_product on a hit."""
import asyncio
import json

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

MCP_URL = "https://mcp.kapruka.com/mcp"
OUT = {}


def parse_result(result):
    sc = getattr(result, "structuredContent", None)
    if isinstance(sc, dict) and "result" in sc:
        raw = sc["result"]
        try:
            return json.loads(raw)
        except Exception:
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
    return parse_result(res)


async def main():
    async with streamablehttp_client(MCP_URL) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for q in ["roses", "chocolate", "cake", "tea gift"]:
                data = await call(session, "kapruka_search_products", {"q": q, "limit": 3})
                OUT[f"search:{q}"] = data
            # get_product on first id we found
            first_id = None
            for q in ["roses", "chocolate", "cake", "tea gift"]:
                d = OUT.get(f"search:{q}")
                if isinstance(d, dict) and d.get("results"):
                    first_id = d["results"][0]["id"]
                    break
            if first_id:
                OUT["get_product"] = await call(session, "kapruka_get_product", {"product_id": first_id})


if __name__ == "__main__":
    asyncio.run(main())
    with open("mcp_probe2.json", "w", encoding="utf-8") as f:
        json.dump(OUT, f, indent=2, ensure_ascii=False, default=str)
    print("wrote mcp_probe2.json")
