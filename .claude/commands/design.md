---
description: Scrive il design e il piano a task di un intent (fase 2 dell'SDLC)
argument-hint: <numero intent, es. 0003>
---
Scrivi il design dell'intent $ARGUMENTS seguendo [docs/sdlc.md](../../docs/sdlc.md). Lavora in sola lettura sul codice (plan mode) finché il design non è approvato.

1. Leggi `docs/intents/$ARGUMENTS-*.md`, `docs/domain.md`, gli ADR e il codice interessato. Per la UI leggi anche `PRODUCT.md` e `DESIGN.md`.
2. Crea `docs/design/$ARGUMENTS-<slug>.md` dal template: contesto, approccio, alternative scartate, impatto (API/DB/UI/migration/rischi) e **piano a task** con la verifica di ogni passo.
3. Se la decisione resta valida nel tempo, proponi un ADR in `docs/adr/`.
4. Porta l'intent a `in design`. Chiedi all'utente di approvare il design prima di iniziare a costruire.
