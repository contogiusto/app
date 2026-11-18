# 0001 — Restyling dell'interfaccia (design)

- **Intent:** [docs/intents/0001-restyling-interfaccia.md](../intents/0001-restyling-interfaccia.md)
- **Stato:** in corso (token, tema e DESIGN.md fatti; mancano i controlli visivi di cameriere/ristoratore e la critique) (direzione "Fintech pulito", ambito tutta l'app, scelti dall'utente il 2026-11-18)

## Contesto
Il tema è in `frontend/src/styles/theme.css` (token con nomi legati alla vecchia palette: `--paper`, `--clay`, `--olive`…), più quattro CSS per area. Molti componenti usano stili inline con `var(--token)`; restano alcuni hex e `rgba(34,28,21,…)` scritti a mano. I titoli usano la classe `.serif` con la font Instrument Serif.

## Approccio
1. **Token semantici** al posto di quelli legati ai colori: `--bg`, `--surface`, `--surface-2`, `--text`, `--text-2`, `--text-3`, `--border`, `--border-strong`, `--accent*`, `--ok*`, `--warn*`, `--danger*`, `--wash-*`, `--scrim`. Rinomina meccanica nel codice (stessi usi, nomi nuovi).
2. **Palette** in OKLCH: neutri freddi leggermente tinti verso l'accento, un accento cobalto, verde/ambra/rosso solo per stati.
3. **Tipografia**: Geist Variable (self-hosted via `@fontsource-variable/geist`) per tutto; importi con `font-variant-numeric: tabular-nums`; la classe `.serif` diventa `.display` (peso 600, tracking negativo).
4. **Forme**: raggi più piccoli (8/12/16), pulsanti 12 px (non pillola), ombre appena percettibili, niente texture "carta".
5. **Interazione** (skill `emil-design-eng`): `:active` con scale, hover solo con `(hover: hover)`, easing ease-out, transizioni sulle proprietà specifiche, focus-visible uniforme, `touch-action: manipulation`, input a 16 px.
6. **Documentazione**: `DESIGN.md` scritto dal tema reale (skill `impeccable document`).
7. Revisione finale con `impeccable critique/audit` e `design-taste-frontend` come lista di controllo.

## Alternative scartate
- **Trattoria contemporanea / Editoriale audace**: scartate dall'utente.
- **Tailwind o libreria UI**: troppo costo di migrazione per un restyling; i token CSS bastano.

## Impatto
- **API / DB:** nessuno.
- **UI:** tutte le schermate (aspetto, non flussi).
- **Dipendenze:** + `@fontsource-variable/geist`, − `@fontsource/instrument-serif`, `@fontsource/hanken-grotesk`.
- **Rischi:** testi che cambiano larghezza con la nuova font (verifica a 375 px); test che cercano la classe `serif`.

## Piano a task
- [x] 1. Intent, design, `PRODUCT.md`.
- [x] 2. Rinomina token e classi — verifica: `npm run lint && npm run test && npm run build` verdi, nessun hex residuo nei componenti.
- [x] 3. Nuovo `theme.css` + font — verifica: avvio dell'app, schermate a 375 px e desktop.
- [ ] 4. Rifinitura per area — fatto il controllo visivo di home, accesso staff e percorso cliente (con API simulata); **da controllare** cameriere e ristoratore (serve backend + DB).
- [x] 5. `DESIGN.md` — verifica: valori uguali a `theme.css`.
- [ ] 6. Critique/audit e correzioni — verifica: contrasto, focus, tastiera.

## Test e verifica
Test esistenti verdi; controllo visivo nel browser per ogni ruolo; contrasto calcolato per le coppie di token principali.
