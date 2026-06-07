"""One-off probe: connect to the Kapruka MCP server, dump tool schemas and a few
sample tool-call responses so we can ground the agent + frontend types in reality.

Run:  .venv\\Scripts\\python.exe probe_mcp.py
"""
import asyncio
import json

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

MCP_URL = "https://mcp.kapruka.com/mcp"

REPORT = {}


def show(title, obj):
    REPORT[title] = obj
    print(f"[captured] {title}")


def content_to_obj(result):
    """Extract a JSON-ish view of a CallToolResult."""
    out = {"isError": getattr(result, "isError", None)}
    sc = getattr(result, "structuredContent", None)
    if sc is not None:
        out["structuredContent"] = sc
    blocks = []
    for c in getattr(result, "content", []) or []:
        if getattr(c, "type", None) == "text":
            txt = c.text
            try:
                blocks.append({"type": "text", "json": json.loads(txt)})
            except Exception:
                blocks.append({"type": "text", "text": txt[:2000]})
        else:
            blocks.append({"type": getattr(c, "type", "?"), "repr": str(c)[:500]})
    out["content"] = blocks
    return out


async def main():
    async with streamablehttp_client(MCP_URL) as (read, write, _get_session_id):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            schemas = []
            for t in tools.tools:
                schemas.append(
                    {
                        "name": t.name,
                        "description": t.description,
                        "inputSchema": t.inputSchema,
                        "outputSchema": getattr(t, "outputSchema", None),
                    }
                )
            show(f"TOOLS/LIST  ({len(schemas)} tools)", schemas)

            # Sample calls (best-effort; wrapped so one failure doesn't kill the rest)
            async def try_call(name, inner):
                # Every Kapruka tool wraps args in `params`; force JSON output.
                inner = {**inner, "response_format": "json"}
                args = {"params": inner}
                try:
                    res = await session.call_tool(name, args)
                    show(f"CALL {name}({inner})", content_to_obj(res))
                except Exception as e:  # noqa: BLE001
                    show(f"CALL {name}({inner}) -> ERROR", {"error": repr(e)})

            await try_call("kapruka_list_categories", {"depth": 1})
            await try_call("kapruka_search_products", {"q": "birthday cake", "limit": 3})
            await try_call("kapruka_list_delivery_cities", {"query": "Colombo", "limit": 5})
            await try_call("kapruka_check_delivery", {"city": "Colombo 03", "delivery_date": "2026-06-20"})


if __name__ == "__main__":
    asyncio.run(main())
    with open("mcp_probe_output.json", "w", encoding="utf-8") as f:
        json.dump(REPORT, f, indent=2, ensure_ascii=False, default=str)
    print("\nWrote mcp_probe_output.json")
