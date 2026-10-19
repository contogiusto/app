from typing import Annotated

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import register_error_handlers
from app.routers import auth, menu, orders, payments, public, sessions, tables

# Su Vercel tutte le richieste /api/* arrivano a questa app: il prefisso è /api.
app = FastAPI(title="Conto Giusto API", docs_url="/api/docs", openapi_url="/api/openapi.json")

app.include_router(auth.router)
app.include_router(menu.router)
app.include_router(tables.router)
app.include_router(sessions.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(public.router)
register_error_handlers(app)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/health/db")
def health_db(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
