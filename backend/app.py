"""Kavi backend — FastAPI on Hugging Face Spaces.

Exposes an SSE chat endpoint that runs the Groq + Kapruka-MCP agent loop.
The Vercel frontend calls this directly (CORS-enabled). The Groq key never
leaves this server.
"""
from __future__ import annotations

import json
import os
import uuid

from dotenv import load_dotenv

load_dotenv()  # local dev: read backend/.env (no-op on HF, which injects secrets)

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import StreamingResponse  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from agent import MODEL, run_agent  # noqa: E402

app = FastAPI(title="Kavi — Kapruka AI Shopping Companion", version="1.0.0")

# --- CORS: allow the Vercel app(s), nivakaran.dev (+ subdomains), and local dev #
_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
allow_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
allow_origins += ["http://localhost:3000", "http://127.0.0.1:3000"]

# Any *.vercel.app preview/prod, plus nivakaran.dev and any of its subdomains
# (e.g. https://kavi.nivakaran.dev). Origin headers carry no path/trailing slash.
ORIGIN_REGEX = r"https://([a-z0-9-]+\.)*(vercel\.app|nivakaran\.dev)$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- request model ----------------------------------------------------------- #
class ChatMessage(BaseModel):
    role: str
    content: str


class CartItem(BaseModel):
    product_id: str
    name: str | None = None
    price: float | None = None
    quantity: int = 1


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    cart: list[CartItem] = Field(default_factory=list)
    thread_id: str | None = None


# --- routes ------------------------------------------------------------------ #
@app.get("/")
async def root():
    return {
        "name": "Kavi backend",
        "status": "ok",
        "model": MODEL,
        "endpoints": {"chat": "POST /api/chat (SSE)", "health": "GET /health"},
    }


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL, "groq_key_set": bool(os.environ.get("GROQ_API_KEY"))}


@app.get("/api/cities")
async def cities(q: str = "", limit: int = 8):
    """Delivery-city autocomplete for the checkout panel (proxies the MCP tool)."""
    if len(q.strip()) < 2:
        return {"cities": []}
    try:
        from mcp_client import call_tool as mcp_call
        from mcp_client import mcp_session

        async with mcp_session() as session:
            data, _err = await mcp_call(
                session, "kapruka_list_delivery_cities", {"query": q.strip(), "limit": limit}
            )
        if isinstance(data, dict) and isinstance(data.get("cities"), list):
            return {"cities": data["cities"]}
    except Exception:  # noqa: BLE001
        pass
    return {"cities": []}


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@app.post("/api/chat")
async def chat(req: ChatRequest):
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    cart = [c.model_dump() for c in req.cart]
    thread_id = req.thread_id or uuid.uuid4().hex

    async def event_stream():
        # Initial comment forces the proxy to flush headers promptly.
        yield ": kavi-stream-open\n\n"
        try:
            async for event in run_agent(messages, cart, thread_id):
                yield _sse(event)
        except Exception as exc:  # noqa: BLE001
            yield _sse({"type": "error", "message": str(exc)})
            yield _sse({"type": "done"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "7860")))
