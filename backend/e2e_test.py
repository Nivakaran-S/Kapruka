"""End-to-end test of the real agent loop (needs GROQ_API_KEY in backend/.env).

Runs a few representative prompts through run_agent and prints a concise trace of
streamed text + tool calls + tool-result kinds, so we can confirm the whole
Groq + Kapruka-MCP pipeline works before touching the UI.

    .venv\\Scripts\\python.exe e2e_test.py
"""
import asyncio
import sys

from dotenv import load_dotenv

load_dotenv()

import os  # noqa: E402

if not os.environ.get("GROQ_API_KEY"):
    print("GROQ_API_KEY not set. Create backend/.env with your key (see .env.example).")
    sys.exit(1)

from agent import MODEL, run_agent  # noqa: E402

PROMPTS = [
    ("EN", "Show me chocolate gift boxes under 5000 LKR for my friend's birthday.", []),
    ("SI", "මට මගේ අම්මාට ලස්සන මල් කළඹක් හොයල දෙන්න පුළුවන්ද?", []),
    ("TL", "machan, malli ta chocolate ekak ona, 4000 ට yatath. mokak ද හොඳ?", []),
]


def short(obj, n=90):
    s = str(obj).replace("\n", " ")
    return s[:n] + ("…" if len(s) > n else "")


async def run_one(label, prompt, cart):
    print("\n" + "#" * 72)
    print(f"# [{label}] {prompt}")
    print("#" * 72)
    text = []
    tool_calls = []
    results = []
    errors = []
    async for ev in run_agent([{"role": "user", "content": prompt}], cart, thread_id=f"e2e-{label}"):
        t = ev["type"]
        if t == "token":
            text.append(ev["text"])
        elif t == "tool_call":
            tool_calls.append((ev["name"], ev["args"]))
            print(f"  → tool_call: {ev['name']}({short(ev['args'], 70)})")
        elif t == "tool_result":
            kind = "ERROR" if ev["is_error"] else type(ev["data"]).__name__
            n = len(ev["data"].get("results", [])) if isinstance(ev["data"], dict) and "results" in ev["data"] else None
            results.append(ev["tool"])
            extra = f" ({n} results)" if n is not None else ""
            print(f"  ← tool_result: {ev['tool']} [{kind}]{extra}")
        elif t == "error":
            errors.append(ev["message"])
            print(f"  !! error: {ev['message']}")
    print("\n  Kavi says:")
    print("  " + "".join(text).replace("\n", "\n  "))
    print(f"\n  summary: {len(tool_calls)} tool call(s), tools={results}, errors={errors}")


async def main():
    print(f"Model: {MODEL}")
    # Default: run the first prompt only (cheap). Pass 'all' to run every language.
    chosen = PROMPTS if (len(sys.argv) > 1 and sys.argv[1] == "all") else PROMPTS[:1]
    for label, prompt, cart in chosen:
        try:
            await run_one(label, prompt, cart)
        except Exception as exc:  # noqa: BLE001
            print(f"  FAILED: {exc!r}")


if __name__ == "__main__":
    asyncio.run(main())
