"""
Entry-point for `uvicorn main:app`.

This project already defines the FastAPI app at `app.main:app`.
We re-export it here so the common command continues to work:

  uvicorn main:app --reload --port 8000
"""

from app.main import app  # noqa: F401

