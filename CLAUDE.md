# CLAUDE.md

Guida per Claude Code in questo repository. Il dominio è in [docs/domain.md](docs/domain.md), le decisioni architetturali in [docs/adr/](docs/adr/), il flusso di lavoro in [CONTRIBUTING.md](CONTRIBUTING.md).

## Progetto
Webapp per ordini e pagamenti nei ristoranti (ruoli: ristoratore, cameriere, cliente via QR). Monorepo:
- `frontend/` — React + TypeScript + Vite (test: Vitest, lint: oxlint)
- `backend/` — FastAPI + SQLAlchemy 2 + Alembic (Python ≥3.11, gestito con `uv`)
- `api/index.py` — entrypoint serverless Vercel, importa `backend/app`
- `design/new_interface/` — prototipo UI di riferimento (non fa parte della build)

## Comandi
```bash
docker compose up -d postgres                        # DB locale
uv sync                                              # dipendenze Python
uv run uvicorn app.main:app --reload --app-dir backend   # API su :8000
cd frontend && npm ci && npm run dev                 # UI su :5173 (proxy /api → :8000)

# Controlli (gli stessi della CI: devono passare prima di ogni PR)
uv run ruff check . && uv run ruff format --check . && uv run pytest
cd frontend && npm run lint && npm run test && npm run build

# Migration (da backend/)
uv run --project .. alembic revision --autogenerate -m "descrizione"
uv run --project .. alembic upgrade head
```

## Regole
- Mai committare su `main` né pushare su `main`: si lavora su `feat/*`, `fix/*`, `chore/*` e si apre una PR.
- Test-first per la logica applicativa; ogni cambio di schema DB ha la sua migration Alembic.
- Tutte le route API vivono sotto `/api` (richiesto dal routing Vercel).
- Niente WebSocket (serverless): il real-time è polling dal frontend. Vedi ADR 0001.
- Segreti solo da variabili d'ambiente (`.env.example` elenca quelle richieste); mai nel codice.
- Il codice dei pagamenti è simulato finché non si decide l'integrazione reale (es. Stripe).
- Commit in stile Conventional Commits (`feat:`, `fix:`, `chore:`…).
