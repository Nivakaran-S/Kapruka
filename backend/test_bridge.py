"""Smoke test (no Groq key needed): fetch + bridge MCP tools, call one tool."""
import asyncio
import json

from mcp_client import call_tool, get_groq_tools, mcp_session


async def main():
    tools = await get_groq_tools()
    print(f"Bridged {len(tools)} tools:")
    for t in tools:
        fn = t["function"]
        req = fn["parameters"].get("required", [])
        print(f"  - {fn['name']}  required={req}")

    # Show the fully-dereferenced create_order schema (the hard one).
    create = next(t for t in tools if t["function"]["name"] == "kapruka_create_order")
    params = create["function"]["parameters"]
    print("\ncreate_order param keys:", list(params.get("properties", {}).keys()))
    cart_items = params["properties"]["cart"]["items"]
    print("cart.items resolved ($ref gone?):", "$ref" not in json.dumps(cart_items))
    print("cart.items.properties:", list(cart_items.get("properties", {}).keys()))
    print("recipient.properties:", list(params["properties"]["recipient"].get("properties", {}).keys()))

    # Live call through the same path the agent uses.
    async with mcp_session() as session:
        data, err = await call_tool(session, "kapruka_search_products", {"q": "roses", "limit": 2})
    print("\nsearch roses -> is_error:", err)
    if isinstance(data, dict):
        for r in data.get("results", [])[:2]:
            print(f"   {r['id']}: {r['name']} — LKR {r['price']['amount']}")


if __name__ == "__main__":
    asyncio.run(main())
