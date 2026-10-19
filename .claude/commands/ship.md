---
description: Verifica, pusha il branch e apre la pull request verso main
---
1. Esegui i controlli di CLAUDE.md (ruff, pytest, lint/test/build frontend): fermati se falliscono.
   Poi esegui `/code-review` sul branch e risolvi i problemi reali.
2. Pusha il feature branch corrente (mai `main`).
3. Apri la PR verso `main` con `gh pr create`, compilando il template in `.github/PULL_REQUEST_TEMPLATE.md`.
4. Riporta il link alla PR e quello della preview Vercel quando disponibile.
