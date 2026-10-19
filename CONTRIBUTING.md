# Flusso di lavoro

## Git flow
1. `main` è sempre deployabile ed è **produzione** (deploy automatico su Vercel). È protetto: niente push diretti.
2. Per ogni lavoro crea un feature branch da `main`: `feat/<nome>`, `fix/<nome>`, `chore/<nome>`.
3. Ogni push sul branch genera una **preview** Vercel (con database Neon dedicato al branch) per provare la feature.
4. Apri una Pull Request verso `main`. Per essere mergiata servono: CI verde (backend + frontend) e una review fatta in locale con la skill `/code-review` prima di aprire la PR.
5. Merge con **squash**; il branch viene cancellato.

## Con Claude Code
- `/new-feature <descrizione>` crea il branch e imposta il lavoro; `/ship` verifica, pusha e apre la PR.
- Prima di aprire la PR esegui `/code-review` sul branch. Non ci sono workflow Claude su GitHub (nessuna API key): se servono in futuro, usa `anthropics/claude-code-action`.

## Setup locale
Vedi i comandi in [CLAUDE.md](CLAUDE.md). Prerequisiti: Python ≥3.11, `uv`, Node ≥20, Docker.

## Protezione di main
L'org è sul piano GitHub Free: i repo privati non permettono la branch protection. Finché non cambia, la regola "niente push su `main`, solo PR con CI verde" è garantita da convenzione, dai `deny` in `.claude/settings.json` e dalla CI; `scripts/setup-github.sh` applicherà la protezione quando sarà disponibile.
