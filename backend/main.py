"""Entrypoint del servizio Vercel (`main:app`): riesporta l'app FastAPI."""

from app.main import app

__all__ = ["app"]
