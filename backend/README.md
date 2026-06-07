---
title: Kapi Backend
emoji: 🎁
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# Kapi — Backend

FastAPI backend for **Kapi**, Sri Lanka's AI shopping companion (Kapruka Agent
Challenge 2026). It runs a **LangGraph ReAct agent** on **Groq** that calls the
**Kapruka MCP** server's 7 commerce tools, streaming results to the Next.js
frontend over SSE.

## Architecture

```
Browser (Vercel / Next.js)  ──SSE──>  FastAPI (here, :7860)
                                         └─ LangGraph ReAct agent
                                              ├─ ChatGroq (langchain-groq)
                                              ├─ Kapruka MCP tools
                                              │    (langchain-mcp-adapters,
                                              │     streamable HTTP, no auth)
                                              └─ InMemorySaver (per-thread memory)
```

- MCP tools are loaded via `langchain-mcp-adapters` and wrapped to force JSON
  output (the gallery needs structured data).
- The agent streams via `astream_events`, mapped to typed SSE events
  (`token`, `tool_call`, `tool_result`, `error`, `done`). Raw tool JSON is
  forwarded so the frontend renders rich product cards.
- **Conversation memory**: each request carries a `thread_id`; an `InMemorySaver`
  checkpointer keeps history (including products shown) so follow-ups like
  "add the second one" work across turns. Only the latest user message is fed
  into the graph each turn. Memory is in-process (resets on restart).

## Endpoints
- `GET /health` — liveness + whether the Groq key is configured.
- `POST /api/chat` — SSE stream. Body: `{ "messages": [{role, content}], "cart": [{product_id, name, price, quantity}] }`.

## Configuration (Space → Settings → Secrets/Variables)
| Var | Required | Default | Notes |
|-----|----------|---------|-------|
| `GROQ_API_KEY` | ✅ secret | — | Groq API key |
| `GROQ_MODEL` | optional | `openai/gpt-oss-120b` | any Groq tool-use model |
| `GROQ_REASONING_EFFORT` | optional | `medium` | gpt-oss only |
| `KAPRUKA_MCP_URL` | optional | `https://mcp.kapruka.com/mcp` | |
| `ALLOWED_ORIGINS` | optional | — | comma-separated; `*.vercel.app` is allowed by default |

## Deploy to Vercel (serverless)

This backend also runs on Vercel as a Python serverless function (`api/index.py`
exposes the FastAPI app; `vercel.json` rewrites all routes to it).

1. **New Project** in Vercel → import this repo.
2. Set **Root Directory = `backend`**.
3. Add env var **`GROQ_API_KEY`** (and optionally `GROQ_MODEL`). `VERCEL=1` is set
   automatically, which switches the agent to **stateless mode** (full chat history
   is replayed each turn instead of using server-side memory).
4. Deploy. Your API is at `https://<project>.vercel.app` (test `…/health`).
5. Point the frontend's `NEXT_PUBLIC_BACKEND_URL` at that URL.

**Caveats (why HF Spaces is still the recommended host):**
- **No durable memory** — serverless instances are ephemeral, so the LangGraph
  checkpointer can't be relied on; the app runs stateless on Vercel.
- **Bundle size** — the LangChain stack is large and may approach Vercel's 250 MB
  function limit. If a build fails on size, host the Docker image on HF instead.
- **Duration** — long agent turns are bounded by `maxDuration` (60s here; raise on
  Pro). Groq is fast, so most turns finish well under that.

## Local development
```bash
python -m venv .venv && .venv/Scripts/activate   # (Windows) or source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then add your GROQ_API_KEY
uvicorn app:app --reload --port 7860
```
