---
description: Verifica, pusha il branch e apre la pull request verso main
---
1. Esegui i controlli di CLAUDE.md (ruff, pytest, lint/test/build frontend): fermati se falliscono.
   Controlla la Definition of Done di `docs/sdlc.md` (criteri dell'intent, docs aggiornati).
   Poi esegui `/code-review` sul branch (contro intent e design) e risolvi i problemi reali.
2. Porta l'intent a `completato` e il design a `realizzato`, se esistono.
3. Pusha il feature branch corrente (mai `main`).
4. Apri la PR verso `main` con `gh pr create`, compilando il template in `.github/PULL_REQUEST_TEMPLATE.md` (link all'intent incluso).
5. Riporta il link alla PR e quello della preview Vercel quando disponibile.
