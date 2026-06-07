"""Vercel serverless entrypoint — exposes the FastAPI ASGI app.

Vercel runs each request as an ephemeral function, so the agent runs in stateless
mode here (the VERCEL env var triggers it in agent.py): the client sends the full
chat history each turn. For persistent server-side memory, deploy the Docker image
on Hugging Face Spaces instead.

Set the Vercel project's Root Directory to `backend/` and add GROQ_API_KEY as an
environment variable.
"""
import os
import sys

# Make the backend root importable (app.py, agent.py, prompts.py live one level up).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app  # noqa: E402  (ASGI app Vercel will serve)

__all__ = ["app"]
