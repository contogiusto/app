# 0002 — Interfaccia più viva (stile app moderna)

- **Stato:** in corso
- **Data:** 2026-11-18
- **Design:** [docs/design/0002-interfaccia-piu-viva.md](../design/0002-interfaccia-piu-viva.md)
- **PR:** (da aprire insieme alla 0001)

## Problema
Dopo il restyling 0001 l'app è pulita ma piatta: poca profondità, transizioni quasi assenti, nessun momento memorabile, nessun marchio (il favicon era ancora quello di Vite).

## Risultato atteso
Sensazione da app nativa moderna: schermate che si susseguono con continuità, feedback fisico a ogni tocco, la cifra da pagare in primo piano, un momento di soddisfazione al pagamento riuscito, finestre che salgono dal basso su telefono.

## Criteri di successo
- [ ] Cambio di passo animato nel percorso cliente; importi che si aggiornano con conteggio.
- [ ] Un solo elemento "hero" per schermata; conferma di pagamento con animazione.
- [ ] Modali come bottom sheet su telefono; barre traslucide.
- [ ] Marchio e favicon propri.
- [ ] `prefers-reduced-motion` e hover gating rispettati; nessuna animazione sulle azioni frequenti dello staff oltre al feedback di pressione.
- [ ] Lint, test e build verdi; nessun cambio di comportamento.

## Fuori scope
Tema scuro, gesti di swipe/drag, librerie di animazione, nuove funzioni.

## Vincoli
Solo CSS e piccoli hook (zero dipendenze nuove); rispettare `DESIGN.md`.
