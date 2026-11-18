---
description: Costruisce un intent già progettato su un feature branch (fase 3 dell'SDLC)
argument-hint: <numero intent, es. 0003>
---
Realizza l'intent $ARGUMENTS. Segui [docs/sdlc.md](../../docs/sdlc.md).

1. Verifica che esistano `docs/intents/$ARGUMENTS-*.md` e `docs/design/$ARGUMENTS-*.md` con design approvato. Se manca il design, fermati e proponi `/design $ARGUMENTS`. (Per un cambio piccolo senza intent, vedi "Cambi piccoli" in `docs/sdlc.md`.)
2. Assicurati che `main` sia aggiornato (`git switch main && git pull`) e crea il branch `feat/<slug>` (oppure `fix/`, `chore/`). Porta l'intent a `in corso`.
3. Lavora un task del piano alla volta, test-first (skill `tdd`); per la UI usa le skill `impeccable`, `emil-design-eng`, `design-taste-frontend`. Spunta i task nel design.
4. Commit piccoli, Conventional Commits, `git add <percorsi>`.
5. Esegui i controlli di CLAUDE.md (backend e frontend) e verifica i criteri di successo dell'intent.
