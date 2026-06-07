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

## Local development
```bash
python -m venv .venv && .venv/Scripts/activate   # (Windows) or source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then add your GROQ_API_KEY
uvicorn app:app --reload --port 7860
```
