# Dominio

Derivato dalla prima bozza del progetto (backend Spring Boot, ora da riscrivere in Python).

## Ruoli
- **Ristoratore** (`/admin`): CRUD menu (nome, prezzo, categoria, disponibilità); gestione tavoli e QR.
- **Cameriere** (`/waiter`): apre la sessione di un tavolo indicando i **coperti**, aggiunge ordini, conferma pagamenti in contanti, può chiudere forzatamente la sessione.
- **Cliente** (`/table/:tableId?token=...`): accede dal QR, vede ordini in tempo reale, paga la propria quota.

## Entità
```
Restaurant └── MenuItem (name, category, price, available)
Table (restaurantId, number, qrCodeToken)
Session (tableId, openedAt, closedAt, status, coperti, paymentMode, version)
  └── OrderItem (sessionId, menuItemId, quantity, addedBy)
Payment (sessionId, amount, mode, paymentMethod, status, customerNickname)
  └── PaymentItem (paymentId, orderItemId, quantity)   # solo modalità OWN
```

## Regole chiave
- `coperti` lo imposta il cameriere all'apertura; `paymentMode` (`ROMANA` | `OWN`) lo sceglie la **prima persona** che accede via QR ed è valido per tutto il tavolo. Impostarlo è idempotente (race tra due persone → vince la prima).
- `PaymentMode` (tavolo) ≠ `PaymentMethod` (singolo pagamento): `ONLINE` → `COMPLETED` (simulato); `CASH` → `CASH`, poi il cameriere conferma.
- ROMANA: importo = totale / coperti; chiusura quando i pagamenti (`COMPLETED|CASH`) ≥ coperti.
- OWN: ognuno seleziona i propri `OrderItem`; chiusura quando tutti gli `OrderItem` sono coperti da `PaymentItem` pagati.
- Concorrenza: lock ottimistico su `Session.version`; conflitto → HTTP 409.
- Auth: JWT stateless. Pubblici: lettura menu, QR, vista pubblica sessione, scelta modalità, creazione pagamenti. Cameriere/ristoratore: sessioni, ordini, conferma cassa. Solo ristoratore: CRUD menu, tavoli, rigenerazione QR.
- La bozza prevedeva anche login clienti (registrazione/Google) e storico pagamenti: da rivalutare in fase di design.
