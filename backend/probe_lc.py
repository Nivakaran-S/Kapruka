"""Introspect langchain-mcp-adapters tools + confirm langgraph import paths."""
import asyncio
import json

from langchain_mcp_adapters.client import MultiServerMCPClient

MCP_URL = "https://mcp.kapruka.com/mcp"


async def main():
    # import paths
    try:
        from langgraph.prebuilt import create_react_agent  # noqa: F401
        print("create_react_agent: langgraph.prebuilt OK")
    except Exception as e:
        print("langgraph.prebuilt.create_react_agent FAILED:", e)
    try:
        from langgraph.checkpoint.memory import InMemorySaver  # noqa: F401
        print("InMemorySaver: langgraph.checkpoint.memory OK")
    except Exception as e:
        print("InMemorySaver FAILED:", e)
    try:
        from langgraph.checkpoint.memory import MemorySaver  # noqa: F401
        print("MemorySaver: langgraph.checkpoint.memory OK")
    except Exception as e:
        print("MemorySaver FAILED:", e)

    client = MultiServerMCPClient({"kapruka": {"url": MCP_URL, "transport": "streamable_http"}})
    tools = await client.get_tools()
    print(f"\nLoaded {len(tools)} tools")
    for t in tools:
        print(f"  - {t.name}  type={type(t).__name__}")

    search = next(t for t in tools if t.name == "kapruka_search_products")
    print("\nargs_schema type:", type(search.args_schema))
    schema = search.args_schema if isinstance(search.args_schema, dict) else getattr(search.args_schema, "model_json_schema", lambda: {})()
    print("schema top keys:", list(schema.get("properties", {}).keys()) if isinstance(schema, dict) else schema)

    # invoke with params wrapper + json
    out = await search.ainvoke({"params": {"q": "roses", "limit": 2, "response_format": "json"}})
    print("\nainvoke output type:", type(out))
    s = out if isinstance(out, str) else getattr(out, "content", str(out))
    print("output head:", str(s)[:160])
    try:
        d = json.loads(s if isinstance(s, str) else s[0]["text"])
        print("parsed results:", len(d.get("results", [])))
    except Exception as e:
        print("parse note:", e)


if __name__ == "__main__":
    asyncio.run(main())
