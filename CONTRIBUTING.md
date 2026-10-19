# Flusso di lavoro

## Git flow
1. `main` è sempre deployabile ed è **produzione** (deploy automatico su Vercel). È protetto: niente push diretti.
2. Per ogni lavoro crea un feature branch da `main`: `feat/<nome>`, `fix/<nome>`, `chore/<nome>`.
3. Ogni push sul branch genera una **preview** Vercel (con database Neon dedicato al branch) per provare la feature.
4. Apri una Pull Request verso `main`. Per essere mergiata servono: CI verde (backend + frontend) e review (anche quella automatica di Claude).
5. Merge con **squash**; il branch viene cancellato.

## Con Claude Code
- `/new-feature <descrizione>` crea il branch e imposta il lavoro; `/ship` verifica, pusha e apre la PR.
- Nelle PR si può chiedere aiuto commentando `@claude ...`.

## Setup locale
Vedi i comandi in [CLAUDE.md](CLAUDE.md). Prerequisiti: Python ≥3.11, `uv`, Node ≥20, Docker.
