# Dominio

Il dominio dell'app com'è oggi. Se cambia una regola, si aggiorna prima questo file (vedi [sdlc.md](sdlc.md)).

## Ruoli
- **Admin centrale** (`SUPERADMIN`): gestisce i ristoranti e gli utenti admin di ciascuno; non vede menu, tavoli né conti dei locali (interfaccia: fase 3b, oggi solo CLI).
- **Ristoratore** (`/admin`, `ADMIN` di un ristorante): CRUD menu (nome, prezzo, categoria, disponibilità); gestione tavoli e QR; in futuro gli utenti del proprio locale (fase 3c).
- **Cameriere** (`/waiter`): apre la sessione di un tavolo indicando i **coperti**, aggiunge ordini, conferma pagamenti in contanti, può chiudere forzatamente la sessione.
- **Cliente** (`/table/:tableId?token=...`): accede dal QR (anche senza account), vede ordini in tempo reale, paga la propria quota. Può avere un account (`/customer/*`) per lo storico dei pagamenti.

## Entità
```
Restaurant (slug, active) └── AppUser (SUPERADMIN: nessun ristorante)
Restaurant └── MenuItem (name, category, price, available)
Table (restaurantId, number, qrCodeToken)
TableSession (tableId, openedAt, closedAt, status, coperti, paymentMode, version)   # tabella `table_session`
  └── OrderItem (sessionId, menuItemId, quantity, unitPrice, addedBy)   # unitPrice = prezzo congelato all'ordine
Payment (sessionId, amount, mode, paymentMethod, status, customerNickname, customerId?)
  └── PaymentItem (paymentId, orderItemId, quantity)   # solo modalità OWN
```

## Regole chiave
- `coperti` lo imposta il cameriere all'apertura; `paymentMode` (`ROMANA` | `OWN`) lo sceglie la **prima persona** che accede via QR ed è valido per tutto il tavolo. Impostarlo è idempotente (race tra due persone → vince la prima).
- `PaymentMode` (tavolo) ≠ `PaymentMethod` (singolo pagamento): `ONLINE` → `COMPLETED` (simulato); `CASH` → `CASH`, poi il cameriere conferma.
- ROMANA: importo = totale / coperti; chiusura quando i pagamenti (`COMPLETED|CASH`) ≥ coperti.
- OWN: ognuno seleziona i propri `OrderItem`; chiusura quando tutti gli `OrderItem` sono coperti da `PaymentItem` pagati.
- Concorrenza: la sessione si blocca con `FOR UPDATE` nella logica dei pagamenti; una sola sessione `OPEN` per tavolo (indice unico parziale); conflitto → HTTP 409.
- **Multi-ristorante**: ogni dato appartiene a un ristorante e un utente staff vede solo il suo; l'admin centrale non ha ristorante. Un ristorante disattivato blocca staff e clienti.
- Auth: JWT stateless. Pubblici: lettura menu, QR, vista pubblica sessione, scelta modalità, creazione pagamenti. Cameriere/ristoratore: sessioni, ordini, conferma cassa. Solo ristoratore: CRUD menu, tavoli, rigenerazione QR.
- Account dei clienti: registrazione/login con email e password, storico pagamenti, eliminazione (il pagamento resta, anonimizzato). Nessuna verifica email né recupero password (scelta di prodotto). Dettagli in [CLAUDE.md](../CLAUDE.md).
