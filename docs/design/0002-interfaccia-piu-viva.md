# 0002 — Interfaccia più viva (design)

- **Intent:** [docs/intents/0002-interfaccia-piu-viva.md](../intents/0002-interfaccia-piu-viva.md)
- **Stato:** realizzato per tema e percorso cliente; da verificare dal vivo su cameriere/ristoratore

## Approccio
Livello "app" in fondo a `theme.css` (classi riusabili) + pochi punti di aggancio nei componenti. Guida: skill `animate` e `emil-design-eng` (ease-out forte, solo `transform`/`opacity`, `:active` scale, hover solo con puntatore preciso, bottom sheet con curva drawer).
- `.step` con `key={current}` in `CustomerApp`; `Money animate` (hook `useTween`, disattivo nei test).
- `.card--hero` per la quota; `.pressable` per le card cliccabili; `.modal-*` per le modali; `.glass` per le barre; `Logo`.
- Conferma di pagamento: `.success-badge` (anello, segno che si disegna, coriandoli CSS).

## Alternative scartate
- Libreria di animazione (Motion): non serve per questo livello e aggiunge peso.
- Gesti di swipe sulle sheet: rimandati, richiedono prove su dispositivo reale.

## Piano a task
- [x] Classi e token di movimento nel tema.
- [x] Percorso cliente: step, hero, conferma, importi animati.
- [x] Modali/sheet, barre, marchio, favicon.
- [ ] Verifica dal vivo su anteprima (cameriere, ristoratore, QR, stampa).
- [ ] `impeccable critique/audit` e prova su telefono vero.
