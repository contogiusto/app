# ADR 0002 — Migration del database al deploy

**Stato:** proposta (da verificare nella prima PR che aggiunge una migration)

## Contesto
Vercel non ha un passo "release" dedicato e il backend è serverless. Neon crea un branch del database per ogni preview: nasce come copia dello schema del parent al momento della creazione, quindi **non** contiene le migration nuove della PR.

## Decisione
1. **Regola di compatibilità (expand/contract):** ogni migration deve funzionare sia con il codice precedente sia con quello nuovo, perché per un attimo i due convivono. Aggiungere colonne/tabelle nullable o con default; rimuovere o rinominare solo in due release distinte.
2. **Produzione:** workflow GitHub `migrate.yml` su push a `main` che esegue `alembic upgrade head` con il secret `DATABASE_URL_UNPOOLED` (connessione diretta Neon, non il pooler). Le migration partono in parallelo al deploy Vercel: per questo vale la regola 1.
3. **Preview:** da verificare se il `buildCommand` del servizio `api` può eseguire `alembic upgrade head` con la `DATABASE_URL` del branch Neon. Se sì, lo si adotta anche per la produzione e si elimina `migrate.yml`; se no, le PR con migration si provano in locale e il branch Neon va ricreato.
4. **Fino ad allora:** la prima migration (`schema iniziale`) si applica a mano: `DATABASE_URL=<url diretta Neon> uv run alembic upgrade head` da `backend/`.

## Conseguenze
- Serve il secret `DATABASE_URL_UNPOOLED` su GitHub (stringa di connessione con password: la inserisce chi gestisce l'account, mai in chat).
- Niente migration automatiche all'avvio dell'app: evita corse tra cold start concorrenti.
- Rollback: `alembic downgrade -1` a mano; le migration distruttive vanno evitate (regola 1).
