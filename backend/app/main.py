from fastapi import FastAPI

# Su Vercel tutte le richieste /api/* arrivano a questa app: il prefisso è /api.
app = FastAPI(title="Perfe API", docs_url="/api/docs", openapi_url="/api/openapi.json")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
