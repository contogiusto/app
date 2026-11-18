# Ciclo di sviluppo (SDLC)

Il flusso segue le pratiche di Anthropic per lavorare con Claude Code: **esplora → pianifica → implementa → verifica**, con il contesto scritto nel repo (non nella testa di nessuno), una verifica che Claude può eseguire da solo (test, lint, app in esecuzione) e una review fatta in un contesto pulito.

Tutto ciò che nasce durante il ciclo vive **nel repo**, in questa struttura:

```
PRODUCT.md            Prodotto: utenti, scopo, tono (letto dalla skill impeccable)
DESIGN.md             Design system: colori, tipografia, componenti (letto da impeccable)
CLAUDE.md             Regole operative e comandi per Claude Code
docs/
  sdlc.md             Questo file
  domain.md           Dominio: ruoli, entità, regole
  intents/NNNN-*.md   Il problema da risolvere e come si misura il successo
  design/NNNN-*.md    Come lo si risolve + piano a task (stesso numero dell'intent)
  adr/NNNN-*.md       Decisioni architetturali durature
```

`intents/` e `design/` hanno lo stesso numero: l'intent 0003 ha il design 0003. I template sono `_template.md` nelle rispettive cartelle.

## Le fasi

| # | Fase | Output | Comando / strumento |
|---|------|--------|---------------------|
| 1 | **Intent** | `docs/intents/NNNN-slug.md` (stato `proposto`) | `/intent <idea>` |
| 2 | **Design** (esplora + pianifica, sola lettura) | `docs/design/NNNN-slug.md` con approccio, alternative, impatto su API/DB/UI e **piano a task** | `/design NNNN` (plan mode; skill `grilling`, `domain-modeling`) |
| 3 | **Build** | Codice + test, commit piccoli | `/new-feature NNNN`; skill `tdd`; per la UI `impeccable`, `emil-design-eng`, `design-taste-frontend` |
| 4 | **Verify** | Controlli verdi + prova nell'app vera | comandi di [CLAUDE.md](../CLAUDE.md); skill `run` |
| 5 | **Review** | Problemi reali risolti | `/code-review` (contesto pulito: Standards + Spec contro intent e design); per la UI `impeccable audit` / `critique` |
| 6 | **Ship** | PR → CI verde → squash merge → preview/produzione | `/ship` |
| 7 | **Learn** | Intent `completato`, docs allineati, ADR se serve | a fine PR |

### 1. Intent
Risponde a *perché* e *cosa*, non a *come*. Un intent ha: problema, utenti, risultato atteso, **criteri di successo verificabili**, fuori scope, vincoli. Se non si riesce a scrivere un criterio verificabile, l'intent non è pronto.
Stati: `proposto` → `in design` → `in corso` → `completato` (o `scartato`, con il motivo).

### 2. Design
Si lavora in plan mode: si legge il codice, si confrontano alternative, si scrive il design. Il design contiene il **piano a task**: elenco di passi piccoli, ognuno con il suo modo di verifica. Per decisioni che restano valide nel tempo (stack, schema, politiche) si scrive anche un ADR. Prima di passare a Build l'utente rivede e approva il design.
Se tocca il dominio si aggiorna `docs/domain.md`; se tocca la UI si parte da `PRODUCT.md` e `DESIGN.md`.

### 3. Build
- Un branch per intent: `feat/*`, `fix/*`, `chore/*` (mai su `main`).
- Test-first per la logica (skill `tdd`); migration Alembic per ogni cambio di schema (ADR 0002).
- Dopo ogni modifica agli endpoint: `export_openapi` + `npm run api:types`.
- Commit piccoli, Conventional Commits, file aggiunti per nome (mai `git add -A`).
- I task del design si spuntano man mano.

### 4. Verify
Definition of Done (tutta vera prima della PR):
- [ ] i criteri di successo dell'intent sono soddisfatti, con evidenza (test, schermata, output);
- [ ] ruff, pytest, lint, test e build del frontend verdi (stessi della CI);
- [ ] per cambi UI: provata nel browser su telefono e desktop, stati vuoto/errore/caricamento inclusi, tastiera e contrasto;
- [ ] docs aggiornati (`domain.md`, `CLAUDE.md`, `DESIGN.md`) e intent segnato `completato`.

### 5-6. Review e Ship
`/code-review` sul branch confronta il codice con le regole del repo e con intent/design. Poi PR con template compilato (il link all'intent è obbligatorio), CI verde, preview Vercel provata, squash merge.

## Cambi piccoli
Un bug di una riga o un ritocco di testo non richiedono intent e design: bastano branch, test e PR. Regola pratica: se il diff si descrive in una frase ed è già chiaro come verificarlo, salta le fasi 1-2.

## Riuso del contesto
Claude non ricorda le sessioni precedenti: ciò che deve sopravvivere va in `docs/`, `CLAUDE.md` o negli ADR. Quando una correzione si ripete, diventa una regola in `CLAUDE.md`.
