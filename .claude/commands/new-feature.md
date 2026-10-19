---
description: Avvia una nuova feature su un feature branch
argument-hint: <descrizione breve>
---
Inizia la feature "$ARGUMENTS":

1. Assicurati che `main` sia aggiornato (`git switch main && git pull`).
2. Crea il branch `feat/<slug-breve>` (oppure `fix/`, `chore/`).
3. Se la feature tocca il dominio, aggiorna prima `docs/domain.md`.
4. Lavora test-first (skill `tdd`), commit piccoli in stile Conventional Commits.
5. Prima di chiudere esegui i controlli di CLAUDE.md (backend e frontend).
