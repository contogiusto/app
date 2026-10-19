"""Entrypoint della funzione Python su Vercel: espone l'app FastAPI di backend/."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402,F401
