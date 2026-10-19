# ADR 0001 — Stack e deploy

**Stato:** accettata

## Decisione
- Monorepo `frontend/` (React+TS+Vite) + `backend/` (FastAPI, SQLAlchemy, Alembic), un solo progetto Vercel.
- Vercel Services: `backend/` è il servizio `api` (FastAPI, entrypoint `main:app`), `frontend/` il servizio `web` (Vite). `vercel.json` instrada `/api/*` ad `api` e il resto a `web`; il servizio riceve il path originale, quindi le route restano sotto `/api`.
- Database: Neon Postgres tramite Marketplace Vercel (un branch DB per ogni preview).
- Real-time: **polling** dal frontend. Le funzioni serverless non mantengono WebSocket; la bozza usava STOMP/WebSocket.
- Flusso: feature branch → PR → `main` protetto con CI obbligatoria; `main` = produzione.

## Conseguenze
- Aggiornamenti non istantanei (latenza = intervallo di polling); si può passare a Pusher/Ably/Supabase Realtime senza cambiare il modello dati.
- Le migration Alembic vanno eseguite sul DB di ogni ambiente (da definire: step di build o job CI).
