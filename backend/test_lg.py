"""Construction-only check for the LangGraph agent (no LLM call, no real key)."""
import asyncio
import os

os.environ.setdefault("GROQ_API_KEY", "gsk_dummy_for_construction_only")

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from langgraph.prebuilt import create_react_agent  # noqa: E402

from agent import MEMORY, _make_llm, get_tools  # noqa: E402
from prompts import system_prompt  # noqa: E402


async def main():
    tools = await get_tools()
    print("tools:", [t.name for t in tools])
    print("all wrapped (have coroutine):", all(t.coroutine is not None for t in tools))
    agent = create_react_agent(_make_llm(), tools, prompt=system_prompt([]), checkpointer=MEMORY)
    print("agent built OK:", type(agent).__name__)
    # also confirm a wrapped tool still calls MCP correctly (real network, no LLM)
    search = next(t for t in tools if t.name == "kapruka_search_products")
    out = await search.ainvoke({"params": {"q": "chocolate", "limit": 1}})
    from agent import _extract_tool_text

    data = _extract_tool_text(out)
    n = len(data.get("results", [])) if isinstance(data, dict) else "n/a"
    print("wrapped search -> json results:", n)


if __name__ == "__main__":
    asyncio.run(main())
