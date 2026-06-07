# Kapi 🐵🎁 — Sri Lanka's AI Shopping Companion

Kapi is a warm, **Sinhala-first** agentic shopping companion for [Kapruka](https://www.kapruka.com),
built for the **Kapruka Agent Challenge 2026**. Chat in English, Sinhala, or Tanglish; Kapi
finds gifts, checks delivery, builds a cart, and takes you to a secure click-to-pay checkout —
with every result rendered as a live visual gallery beside the chat.

## Architecture

```
 Browser (Vercel · Next.js 16)  ──SSE──>  FastAPI (Hugging Face Spaces · Docker:7860)
 ┌───────────────┬────────────┐            └─ LangGraph ReAct agent
 │ Chat (40%)    │ Gallery 60%│                 ├─ ChatGroq (langchain-groq)
 │ Cart · Checkout · Tracking │                 ├─ Kapruka MCP tools (langchain-mcp-adapters)
 └───────────────┴────────────┘                 └─ per-thread memory (InMemorySaver)
```

- **Backend** is a LangGraph ReAct agent: it loads the 7 Kapruka MCP tools via
  `langchain-mcp-adapters` (wrapped to force JSON), runs on Groq via `ChatGroq`, keeps per-thread
  conversation memory, and streams typed SSE events (`token`, `tool_call`, `tool_result`,
  `error`, `done`). Raw tool JSON is forwarded so the frontend renders real product cards.
  See [`backend/`](backend/).
- **Frontend** is a split-panel Next.js app; the gallery is driven by `tool_result` events.
  See [`frontend/`](frontend/).

## The 7 MCP tools (all used)
`kapruka_search_products` · `kapruka_get_product` · `kapruka_list_categories` ·
`kapruka_list_delivery_cities` · `kapruka_check_delivery` · `kapruka_create_order` ·
`kapruka_track_order`

## Run locally

**Backend**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate      # Windows  (or: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env                               # then add your GROQ_API_KEY
uvicorn app:app --reload --port 7860
```

**Frontend**
```bash
cd frontend
npm install
# .env.local already points at http://localhost:7860
npm run dev    # http://localhost:3000
```

## Deploy
- **Backend → Hugging Face Spaces (Docker):** create a Space (SDK: Docker), push `backend/`,
  set `GROQ_API_KEY` as a secret. Public URL: `https://<user>-<space>.hf.space`.
- **Frontend → Vercel:** import `frontend/`, set `NEXT_PUBLIC_BACKEND_URL` to the HF URL.

## Configuration
| Var | Side | Notes |
|-----|------|-------|
| `GROQ_API_KEY` | backend | required (Groq key) |
| `GROQ_MODEL` | backend | default `llama-3.3-70b-versatile` |
| `KAPRUKA_MCP_URL` | backend | default `https://mcp.kapruka.com/mcp` |
| `ALLOWED_ORIGINS` | backend | `*.vercel.app` already allowed |
| `NEXT_PUBLIC_BACKEND_URL` | frontend | the HF Space URL |
