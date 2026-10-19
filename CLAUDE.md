# CLAUDE.md

Guida per Claude Code in questo repository. Il dominio è in [docs/domain.md](docs/domain.md), le decisioni architetturali in [docs/adr/](docs/adr/), il flusso di lavoro in [CONTRIBUTING.md](CONTRIBUTING.md).

## Progetto
Webapp per ordini e pagamenti nei ristoranti (ruoli: ristoratore, cameriere, cliente via QR). Monorepo:
- `frontend/` — React + TypeScript + Vite (test: Vitest, lint: oxlint)
- `backend/` — FastAPI + SQLAlchemy 2 + Alembic (Python ≥3.11, gestito con `uv`; è anche il servizio Vercel `api`)
- `design/new_interface/` — prototipo UI di riferimento (non fa parte della build)

## Comandi
```bash
docker compose up -d postgres                        # DB locale
cd backend && uv sync && uv run uvicorn app.main:app --reload   # API su :8000
cd frontend && npm ci && npm run dev                 # UI su :5173 (proxy /api → :8000)

# Controlli (gli stessi della CI; i test usano il Postgres di docker compose su :5433)
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
cd frontend && npm run lint && npm run test && npm run build

# Migration (da backend/)
uv run alembic revision --autogenerate -m "descrizione"
uv run alembic upgrade head
```

## Regole
- Mai committare su `main` né pushare su `main`: si lavora su `feat/*`, `fix/*`, `chore/*` e si apre una PR.
- Test-first per la logica applicativa; ogni cambio di schema DB ha la sua migration Alembic (compatibile con la versione di codice precedente: vedi ADR 0002).
- Dopo `alembic revision --autogenerate` controlla il file: Alembic duplica i CHECK degli `Enum` (vedi la migration iniziale) e va rivisto a mano.
- Tutte le route API vivono sotto `/api` (richiesto dal routing Vercel).
- Niente WebSocket (serverless): il real-time è polling dal frontend. Vedi ADR 0001.
- Segreti solo da variabili d'ambiente (`.env.example` elenca quelle richieste); mai nel codice.
- Auth staff: JWT HS256 (24h) da `POST /api/auth/login`. Le route protette usano le dipendenze di `app/deps.py` (`CurrentUser`, `AdminUser`, `require_roles(...)`); lettura menu pubblica, scrittura solo ADMIN.
- `JWT_SECRET` va impostato su Vercel (Production e Preview, almeno 32 caratteri casuali): in produzione col valore di default login e token rispondono con errore.
- Utenti staff: nessuna password predefinita. Si creano con `cd backend && uv run python -m app.cli create-user <username> <ADMIN|WAITER>` (con `DATABASE_URL` del DB di destinazione).
- App a ristorante singolo per ora: menu e tavoli appartengono al primo `Restaurant` (creato al primo piatto o tavolo).
- Il QR di un tavolo (`GET /api/tables/{id}/qr.svg`, solo ADMIN) codifica `FRONTEND_URL/table/<id>?token=<qr_token>`: `FRONTEND_URL` va impostato su Vercel con il dominio di produzione. Il `qr_token` non è mai nell'elenco tavoli.
- Una sola sessione `OPEN` per tavolo: lo garantisce un indice unico parziale nel DB (le richieste concorrenti perdenti ricevono 409).
- Il codice dei pagamenti è simulato finché non si decide l'integrazione reale (es. Stripe).
- Commit in stile Conventional Commits (`feat:`, `fix:`, `chore:`…).
