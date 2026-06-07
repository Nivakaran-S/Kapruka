"""Kapruka MCP client + Groq tool-schema bridge.

The Kapruka MCP server (https://mcp.kapruka.com/mcp) is a public, no-auth,
Streamable-HTTP MCP server exposing 7 tools. Two quirks we handle here:

1. Every tool wraps its real arguments in a single ``params`` object, and the
   inputSchema uses ``$ref``/``$defs``. We expose a *flattened inner* schema to
   the LLM (so it fills natural fields like ``q``/``recipient`` directly) and
   re-wrap into ``{"params": {...}}`` before calling MCP.
2. Each tool supports ``response_format: "markdown" | "json"``. We always force
   ``json`` so the frontend gets structured data, and we strip that field from
   the schema shown to the model.

Tool results arrive as a JSON *string* inside ``structuredContent.result`` (or a
text content block); we parse it into a Python object.
"""
from __future__ import annotations

import copy
import json
import os
from contextlib import asynccontextmanager
from typing import Any

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

MCP_URL = os.environ.get("KAPRUKA_MCP_URL", "https://mcp.kapruka.com/mcp")

# The 7 Kapruka tools (used to validate / order the bridged tool list).
KAPRUKA_TOOLS = [
    "kapruka_search_products",
    "kapruka_get_product",
    "kapruka_list_categories",
    "kapruka_list_delivery_cities",
    "kapruka_check_delivery",
    "kapruka_create_order",
    "kapruka_track_order",
]

_groq_tools_cache: list[dict] | None = None


# --------------------------------------------------------------------------- #
# Schema bridging
# --------------------------------------------------------------------------- #
def _deref(node: Any, defs: dict) -> Any:
    """Recursively inline ``$ref: #/$defs/X`` references using ``defs``."""
    if isinstance(node, dict):
        if "$ref" in node:
            ref_name = node["$ref"].split("/")[-1]
            return _deref(copy.deepcopy(defs.get(ref_name, {})), defs)
        return {k: _deref(v, defs) for k, v in node.items()}
    if isinstance(node, list):
        return [_deref(item, defs) for item in node]
    return node


def _inner_schema(input_schema: dict) -> dict:
    """Resolve a Kapruka tool inputSchema down to the inner ``params`` object
    schema (fully dereferenced, with ``response_format`` removed)."""
    defs = input_schema.get("$defs", {})
    params_node = input_schema.get("properties", {}).get("params", {})
    resolved = _deref(params_node, defs)
    if isinstance(resolved, dict):
        resolved.pop("$defs", None)
        props = resolved.get("properties")
        if isinstance(props, dict):
            props.pop("response_format", None)
        # Keep additionalProperties:false so providers validate strictly.
        resolved.setdefault("type", "object")
    return resolved


def _to_groq_tool(name: str, description: str | None, input_schema: dict) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": (description or "").strip(),
            "parameters": _inner_schema(input_schema),
        },
    }


# --------------------------------------------------------------------------- #
# Session + tool listing/calling
# --------------------------------------------------------------------------- #
@asynccontextmanager
async def mcp_session():
    """Open an initialized MCP session for the duration of one chat turn."""
    async with streamablehttp_client(MCP_URL) as (read, write, _get_session_id):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield session


async def get_groq_tools(force: bool = False) -> list[dict]:
    """Return the 7 Kapruka tools as Groq/OpenAI function-calling schemas.

    Cached in-process after the first fetch (schemas are static)."""
    global _groq_tools_cache
    if _groq_tools_cache is not None and not force:
        return _groq_tools_cache
    async with mcp_session() as session:
        listed = await session.list_tools()
    tools = [_to_groq_tool(t.name, t.description, t.inputSchema) for t in listed.tools]
    _groq_tools_cache = tools
    return tools


def _extract(result: Any) -> Any:
    """Pull a parsed Python object out of an MCP CallToolResult."""
    structured = getattr(result, "structuredContent", None)
    if isinstance(structured, dict) and "result" in structured:
        raw = structured["result"]
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return raw
        return raw
    for block in getattr(result, "content", []) or []:
        if getattr(block, "type", None) == "text":
            try:
                return json.loads(block.text)
            except json.JSONDecodeError:
                return block.text
    return None


async def call_tool(session: ClientSession, name: str, arguments: dict | None) -> tuple[Any, bool]:
    """Call a Kapruka tool. ``arguments`` is the *inner* dict (the model's view).

    Returns ``(parsed_data, is_error)``."""
    inner = dict(arguments or {})
    # Tolerate a model that already wrapped its args in ``params``.
    if set(inner.keys()) == {"params"} and isinstance(inner["params"], dict):
        inner = dict(inner["params"])
    inner["response_format"] = "json"
    result = await session.call_tool(name, {"params": inner})
    data = _extract(result)
    is_error = bool(getattr(result, "isError", False))
    return data, is_error
