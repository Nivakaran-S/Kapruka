"""The Kavi agent — LangGraph ReAct agent over Groq (langchain-groq) with the
Kapruka MCP tools loaded via langchain-mcp-adapters, plus an in-memory
checkpointer so each conversation thread remembers prior turns (incl. the
products it showed — so "add the second one" works across turns).

Run as an async generator that yields SSE-ready events:
  {"type": "token",       "text": "..."}
  {"type": "tool_call",   "name": "...", "args": {...}}
  {"type": "tool_result", "tool": "...", "data": ..., "is_error": bool}
  {"type": "error",       "message": "..."}
  {"type": "done"}
"""
from __future__ import annotations

import copy
import json
import os
from typing import Any, AsyncGenerator

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.tools import StructuredTool
from langchain_groq import ChatGroq
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.prebuilt import create_react_agent

from prompts import system_prompt

MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
REASONING_EFFORT = os.environ.get("GROQ_REASONING_EFFORT", "low")
MAX_TOKENS = int(os.environ.get("GROQ_MAX_TOKENS", "1024"))
RECURSION_LIMIT = int(os.environ.get("AGENT_RECURSION_LIMIT", "12"))
MCP_URL = os.environ.get("KAPRUKA_MCP_URL", "https://mcp.kapruka.com/mcp")

# Concise, model-facing tool descriptions. The raw MCP docstrings are ~3k tokens
# total and are sent on EVERY call — these one-liners cut that to a few hundred.
TOOL_DESCRIPTIONS = {
    "kapruka_search_products": (
        "Search the Kapruka catalog. q must be >=3 specific chars (e.g. 'chocolate cake', "
        "not 'cake'). Optional: category, min_price, max_price, in_stock_only, sort, limit, currency."
    ),
    "kapruka_get_product": "Full details (images, variants, stock, price) for one product_id.",
    "kapruka_list_categories": "List Kapruka product categories.",
    "kapruka_list_delivery_cities": "Find Kapruka delivery cities by name (query). Returns canonical city names.",
    "kapruka_check_delivery": (
        "Delivery feasibility + flat LKR rate for a city on a date. Pass product_id for "
        "cake/flower perishable warnings."
    ),
    "kapruka_create_order": (
        "Create a guest order, returns a click-to-pay URL. Needs cart[{product_id,quantity,icing_text?}], "
        "recipient{name,phone}, delivery{address,city,date}, sender{name}, optional gift_message."
    ),
    "kapruka_track_order": "Track an order by its Kapruka order_number (from the post-payment email).",
}

# Stateless mode: on ephemeral serverless (Vercel sets VERCEL=1) in-process memory
# can't be trusted across instances, so we don't use the checkpointer and instead
# replay the full client-sent history each turn. On HF (always-on process) we use
# the per-thread checkpointer for efficient memory.
STATELESS = bool(os.environ.get("KAVI_STATELESS") or os.environ.get("VERCEL"))

# In-process conversation memory (per thread_id). Resets on restart — fine for
# a single-process HF Space; swap for a persistent saver to survive restarts.
MEMORY = InMemorySaver()

_tools_cache: list[StructuredTool] | None = None


# Schema keys the model doesn't need (the MCP server re-validates server-side).
# Dropping them shrinks the per-call payload a lot (esp. create_order's nested schema).
_SCHEMA_DROP_KEYS = {
    "description", "title", "default", "format", "examples",
    "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
    "minLength", "maxLength", "minItems", "maxItems",
}


def _slim_schema(node: Any) -> Any:
    """Strip non-essential metadata/bounds from a JSON schema (keeps type, enum,
    required, properties). Sent to the model every call, so this saves many tokens."""
    if isinstance(node, dict):
        return {k: _slim_schema(v) for k, v in node.items() if k not in _SCHEMA_DROP_KEYS}
    if isinstance(node, list):
        return [_slim_schema(item) for item in node]
    return node


def _deref(node: Any, defs: dict) -> Any:
    """Inline `$ref: #/$defs/X` references using ``defs``."""
    if isinstance(node, dict):
        if "$ref" in node:
            ref = node["$ref"].split("/")[-1]
            return _deref(copy.deepcopy(defs.get(ref, {})), defs)
        return {k: _deref(v, defs) for k, v in node.items()}
    if isinstance(node, list):
        return [_deref(item, defs) for item in node]
    return node


def _relax_numeric(node: Any) -> Any:
    """Let numeric leaves also accept a string. Models (esp. Llama) often emit
    numbers as strings (e.g. max_price="5000"); we coerce them back at call time."""
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            if k == "type" and v in ("number", "integer"):
                out[k] = [v, "string"]
            else:
                out[k] = _relax_numeric(v)
        return out
    if isinstance(node, list):
        return [_relax_numeric(item) for item in node]
    return node


_NUMERIC_FIELDS = {"min_price", "max_price", "limit", "depth", "quantity"}


def _to_num(s: Any) -> Any:
    if not isinstance(s, str):
        return s
    try:
        f = float(s)
        return int(f) if f.is_integer() else f
    except ValueError:
        return s


def _coerce_numbers(params: dict) -> dict:
    """Coerce stringified numbers back to numbers before calling the MCP tool."""
    for field in _NUMERIC_FIELDS:
        if field in params:
            params[field] = _to_num(params[field])
    cart = params.get("cart")
    if isinstance(cart, list):
        for item in cart:
            if isinstance(item, dict) and "quantity" in item:
                item["quantity"] = _to_num(item["quantity"])
    return params


# Fields not worth exposing to the model (noise / token cost / error surface).
DROP_FIELDS = {"cursor", "include_stubs", "type", "response_format"}
# Restore enum constraints lost when stripping descriptions, so the model can't
# invent invalid values (e.g. sort="price").
FIELD_ENUMS = {"sort": ["relevance", "price_asc", "price_desc", "newest", "bestseller"]}


def _inner_schema(args_schema: dict) -> dict:
    """Kapruka tools wrap real args in a single `params` object. Models (esp. Llama)
    won't reliably produce that nesting, so we expose the FLATTENED inner schema to
    the model and re-wrap into {"params": ...} when calling. Also derefs $defs,
    drops noise fields, restores key enums, and slims metadata."""
    defs = args_schema.get("$defs", {})
    params = args_schema.get("properties", {}).get("params", {})
    resolved = _deref(params, defs)
    if isinstance(resolved, dict):
        resolved.pop("$defs", None)
        props = resolved.get("properties")
        if isinstance(props, dict):
            for f in DROP_FIELDS:
                props.pop(f, None)
            for field, values in FIELD_ENUMS.items():
                if isinstance(props.get(field), dict):
                    props[field]["enum"] = values
        req = resolved.get("required")
        if isinstance(req, list):
            resolved["required"] = [r for r in req if r not in DROP_FIELDS]
        resolved.setdefault("type", "object")
    return _relax_numeric(_slim_schema(resolved))


def _force_json(tool: StructuredTool) -> StructuredTool:
    """Wrap a Kapruka MCP tool: flatten the `params` wrapper for the model, re-wrap +
    force JSON output on call, with a concise description and slim schema."""

    async def _call(**kwargs: Any) -> Any:
        # Tolerate a model that wrapped args in `params` anyway.
        if set(kwargs) == {"params"} and isinstance(kwargs["params"], dict):
            params = dict(kwargs["params"])
        else:
            params = {k: v for k, v in kwargs.items() if v is not None}
        params = _coerce_numbers(params)
        # Keep result payloads small (fed back to the model each round) — cap/limit.
        if "limit" in params:
            try:
                params["limit"] = max(1, min(int(params["limit"]), 8))
            except (TypeError, ValueError):
                params["limit"] = 6
        elif tool.name == "kapruka_search_products":
            params["limit"] = 6
        params["response_format"] = "json"
        try:
            return await tool.ainvoke({"params": params})
        except Exception as exc:  # noqa: BLE001
            # Return the error so the agent can self-correct, rather than dying.
            return f"Error calling {tool.name}: {exc}. Fix the arguments and try again."

    return StructuredTool(
        name=tool.name,
        description=TOOL_DESCRIPTIONS.get(tool.name, (tool.description or "").strip()[:200]),
        args_schema=_inner_schema(tool.args_schema),
        coroutine=_call,
    )


async def get_tools() -> list[StructuredTool]:
    global _tools_cache
    if _tools_cache is None:
        client = MultiServerMCPClient(
            {"kapruka": {"url": MCP_URL, "transport": "streamable_http"}}
        )
        raw = await client.get_tools()
        _tools_cache = [_force_json(t) for t in raw]
    return _tools_cache


def _make_llm() -> ChatGroq:
    kwargs: dict[str, Any] = {
        "model": MODEL,
        "temperature": 0.6,
        "max_tokens": MAX_TOKENS,  # cap output tokens (helps stay under TPM limits)
        "max_retries": 2,          # auto-retry transient 429s (respects Retry-After)
        # One tool call per step — avoids the model firing duplicate parallel searches.
        "model_kwargs": {"parallel_tool_calls": False},
    }
    if "gpt-oss" in MODEL:
        kwargs["reasoning_effort"] = REASONING_EFFORT
    return ChatGroq(**kwargs)


def _extract_tool_text(output: Any) -> Any:
    """Pull a parsed object out of a tool result (content blocks / ToolMessage / str)."""
    content = getattr(output, "content", output)
    text: str | None = None
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                text = block.get("text")
                break
            if isinstance(block, str):
                text = block
                break
    elif isinstance(content, str):
        text = content
    if text is None:
        return content
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return text


def _last_user(messages: list[dict[str, Any]]) -> str:
    for m in reversed(messages):
        if m.get("role") == "user":
            return m.get("content", "")
    return messages[-1].get("content", "") if messages else ""


def _to_lc_messages(messages: list[dict[str, Any]]) -> list[Any]:
    """Convert the client-sent chat history to LangChain messages (stateless mode)."""
    out: list[Any] = []
    for m in messages:
        role, content = m.get("role"), m.get("content", "")
        if role == "user":
            out.append(HumanMessage(content=content))
        elif role == "assistant" and content:
            out.append(AIMessage(content=content))
    return out


def _is_error(data: Any) -> bool:
    if isinstance(data, dict) and "error" in data:
        return True
    if isinstance(data, str) and data.strip().lower().startswith("error"):
        return True
    return False


async def run_agent(
    messages: list[dict[str, Any]],
    cart: list[dict[str, Any]] | None = None,
    thread_id: str = "default",
) -> AsyncGenerator[dict[str, Any], None]:
    """Drive one assistant turn. Thread memory supplies prior context, so we only
    feed the latest user message into the graph."""
    try:
        tools = await get_tools()
    except Exception as exc:  # noqa: BLE001
        yield {"type": "error", "message": f"Could not load shopping tools: {exc}"}
        yield {"type": "done"}
        return

    # Build per-request so the system prompt reflects the current cart.
    if STATELESS:
        # No durable memory available — replay the full client history each turn.
        agent = create_react_agent(_make_llm(), tools, prompt=system_prompt(cart))
        payload = {"messages": _to_lc_messages(messages)}
        config: dict[str, Any] = {"recursion_limit": RECURSION_LIMIT}
    else:
        # Always-on process — the shared MEMORY checkpointer keeps history per thread,
        # so we only feed the latest user message.
        agent = create_react_agent(
            _make_llm(), tools, prompt=system_prompt(cart), checkpointer=MEMORY
        )
        payload = {"messages": [HumanMessage(content=_last_user(messages))]}
        config = {"configurable": {"thread_id": thread_id}, "recursion_limit": RECURSION_LIMIT}

    try:
        async for ev in agent.astream_events(payload, config=config, version="v2"):
            kind = ev.get("event")
            if kind == "on_chat_model_stream":
                chunk = ev["data"].get("chunk")
                text = getattr(chunk, "content", "") if chunk is not None else ""
                if isinstance(text, list):
                    text = "".join(
                        b.get("text", "") for b in text if isinstance(b, dict)
                    )
                if text:
                    yield {"type": "token", "text": text}
            elif kind == "on_tool_start":
                args = ev["data"].get("input") or {}
                inner = args.get("params", args) if isinstance(args, dict) else args
                yield {"type": "tool_call", "name": ev.get("name", ""), "args": inner}
            elif kind == "on_tool_end":
                data = _extract_tool_text(ev["data"].get("output"))
                yield {
                    "type": "tool_result",
                    "tool": ev.get("name", ""),
                    "data": data,
                    "is_error": _is_error(data),
                }
        yield {"type": "done"}
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        low = msg.lower()
        if "rate_limit" in low or "429" in low or "tokens per minute" in low:
            msg = "I'm getting rate-limited right now 🙏 — please try again in a few seconds."
        elif "recursion" in low and "limit" in low:
            msg = "That request needed too many steps — could you narrow it down a little?"
        yield {"type": "error", "message": msg}
        yield {"type": "done"}
