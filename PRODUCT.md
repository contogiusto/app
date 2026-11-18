# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Cliente al tavolo** (telefono, spesso in piedi o con una mano sola, luce di sala, fretta di chiudere il conto): arriva dal QR, vede cosa è stato ordinato e paga la propria parte (alla romana o per voci). Può essere ospite o avere un account per lo storico.
- **Cameriere** (tablet o telefono, in sala, interrotto di continuo): apre i tavoli con i coperti, inserisce gli ordini, conferma i contanti, chiude i conti.
- **Ristoratore** (tablet o computer, a fine servizio o prima di aprire): gestisce menu, disponibilità e tavoli con i loro QR.

## Product Purpose
Conto Giusto elimina la fatica di "fare il conto" al tavolo: ogni commensale paga la sua parte dal telefono, il ristorante vede in tempo reale cosa è coperto. Successo = tavolo chiuso senza calcolatrici, senza discussioni e senza che il cameriere debba dividere a mano.

## Positioning
Il conto si divide da solo e in modo equo (alla romana con l'ultimo che copre il resto, oppure per voci), con il server come unica fonte dei numeri.

## Operating Context
App a ristorante singolo. Pagamenti **simulati** (nessun form carta, nessun dato di pagamento digitato nell'app). Aggiornamento per polling ogni 3 s. Il QR del tavolo contiene un token: non va mai salvato nel repo. Hosting Vercel Hobby + Neon (vincolo zero costi).

## Capabilities and Constraints
- Ruoli e flussi: vedi [docs/domain.md](docs/domain.md).
- Importi gestiti in centesimi interi; il frontend mostra, non ricalcola quote e chiusura.
- Lingua dell'interfaccia: italiano.
- Font self-hosted (niente Google Fonts), nessun servizio esterno a runtime.

## Evidence on Hand
Nessun cliente, recensione o metrica reale: non inventarne nei testi.

## Product Principles
1. **Il numero prima di tutto**: importi e stato del conto sono sempre l'elemento più leggibile della schermata.
2. **Una mano, poca luce, poca pazienza**: bersagli ampi, passi brevi, nessun testo da decifrare.
3. **Fiducia tramite chiarezza**: ogni cifra spiega da dove viene; gli errori dicono cosa fare.
4. **Sala e cucina non aspettano**: stati di caricamento e aggiornamento discreti, mai bloccanti.

## Accessibility & Inclusion
Obiettivo WCAG 2.2 AA: contrasto, focus visibile, uso da tastiera, `prefers-reduced-motion`, bersagli touch ≥ 44 px. Interfaccia leggibile da chi non ha dimestichezza con le app.
