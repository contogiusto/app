# 0003 — Più ristoranti (design)

- **Intent:** [docs/intents/0003-multi-ristorante.md](../intents/0003-multi-ristorante.md)
- **Stato:** approvato (2026-11-18); fase 3a realizzata
- **ADR da scrivere:** multi-tenancy a colonna (e perché non uno schema o un DB per ristorante)

## Contesto
`Restaurant` esiste già e `MenuItem`/`RestaurantTable` hanno `restaurant_id`, ma `app/routers/menu.py:ristorante_singolo` crea/usa sempre il primo. `AppUser` non ha ristorante; i ruoli sono `ADMIN`/`WAITER` (`app/deps.py`: `AdminUser`, `StaffUser`). `TableSession`, ordini e pagamenti dipendono dal tavolo, quindi ereditano il ristorante. Il QR codifica `FRONTEND_URL/table/<id>?token=<qr_token>`. Il frontend ha `/admin/*` e `/waiter/*`.

## Approccio

### Modello
- `restaurant`: + `slug` (unico, minuscolo, `[a-z0-9-]{3,40}`, con elenco di slug riservati: `piattaforma`, `table`, `customer`, `privacy`, `api`, `ristorante`…), `active` (bool), `created_at`.
- `app_user`: + `restaurant_id` (FK, null per l'admin centrale). Ruolo `SUPERADMIN` (solo con `restaurant_id` nullo) accanto a `ADMIN` e `WAITER` (solo con `restaurant_id` valorizzato): vincolo CHECK. Username unico **per ristorante** (`UNIQUE(restaurant_id, username)` più un indice parziale per i `NULL`). Campi `must_change_password` (la password provvisoria la imposta chi crea l'utenza) e `active`.
- Il ristorante dell'utente si legge **sempre dal DB**, mai dal token: il JWT porta solo `sub`, così un cambio di ristorante o una disattivazione hanno effetto subito.

### Isolamento (la parte che non si può sbagliare)
- Una dipendenza `RestaurantContext` ricava il ristorante dall'utente corrente; **tutte** le query staff filtrano per `restaurant_id` (menu, tavoli, sessioni via tavolo, ordini, pagamenti). Un id di un altro ristorante risponde 404, non 403 (non rivela l'esistenza).
- Test parametrizzato "due ristoranti": per ogni endpoint staff, un utente del ristorante A prova a leggere e scrivere risorse del B → 404. Deve fallire se si toglie un filtro (come `test_concurrency` per il lock).
- `SUPERADMIN` non opera sui dati dei ristoranti (menu, tavoli, ordini): gestisce solo ristoranti e utenti.
- Un ristorante con `active=false` blocca il login dello staff e l'accesso dei clienti ai suoi tavoli (404).

### API
- Piattaforma (`SUPERADMIN`): `GET/POST /api/platform/restaurants`, `PATCH /api/platform/restaurants/{id}` (nome, slug, attivo), `GET/POST /api/platform/restaurants/{id}/users`, `PATCH/DELETE …/users/{uid}`, `POST …/users/{uid}/reset-password`.
- Ristorante (`ADMIN`): `GET/POST /api/users`, `PATCH/DELETE /api/users/{id}`, `POST /api/users/{id}/reset-password` (solo utenti del proprio ristorante; regole su sé stesso e sull'ultimo admin; impossibile creare un `SUPERADMIN`).
- Login: `POST /api/auth/login` accetta `restaurant` (slug) opzionale: assente → solo `SUPERADMIN`; presente → solo utenti di quel ristorante. Stesso errore generico e stesso rate limit in ogni caso. `POST /api/auth/change-password` (obbligatoria se `must_change_password`).
- Pubblico: `GET /api/public/restaurants/{slug}` (nome, attivo). Gli endpoint dei tavoli restano `/api/public/tables/{id}` col token QR; la risposta aggiunge `restaurant_slug`.
- Si elimina `ristorante_singolo`.

### Indirizzi e QR (frontend)
`/ristorante/:slug` (pagina pubblica del locale), `/ristorante/:slug/accesso` (login staff), `/ristorante/:slug/admin/*` e `/ristorante/:slug/waiter/*`, `/ristorante/:slug/tavolo/:id?token=` (cliente), `/piattaforma/*` (admin centrale, login su `/piattaforma/accesso`). Le vecchie `/table/:id?token=`, `/admin`, `/waiter`, `/staff/login` fanno redirect (il ristorante si ricava dal tavolo o dall'utente), così i QR già stampati non si rompono. Il nuovo contenuto del QR è `FRONTEND_URL/ristorante/<slug>/tavolo/<id>?token=…` (da `app/routers/tables.py:qr_url`). `parseTableLink` accetta entrambe le forme ed è l'unico validatore del contenuto del QR.

### Migration (ADR 0002: espandi → migra → restringi)
1. *Espandi* (compatibile col codice vecchio): colonne nuove nullable o con default; `slug` del ristorante esistente derivato dal nome; CHECK dei ruoli allargato a `SUPERADMIN`. Gli utenti `ADMIN` esistenti restano `ADMIN` e vengono legati al primo ristorante: il codice nuovo li tratta come admin di quel locale.
2. *Promuovi* (decisione confermata: l'admin attuale diventa admin centrale): a deploy completato, la CLI `promote-superadmin <username>` porta l'utente attuale a admin centrale (e `create-user` accetta `--restaurant <slug>`). Si passa dal codice perché `SUPERADMIN` non è `ADMIN` per il codice vecchio: promuovere durante la transizione romperebbe il vecchio deploy.
3. *Restringi*: `restaurant.slug` NOT NULL e unico, CHECK definitivo sui ruoli.

## Alternative scartate
- **Schema o database per ristorante**: isolamento più forte, ma Neon free ha pochi branch/DB e le migration andrebbero lanciate N volte.
- **Row Level Security di Postgres**: valida in futuro come seconda difesa; ora filtri applicativi e test di isolamento bastano e sono più semplici da provare.
- **Sottodomini**: costo del dominio e DNS wildcard, rimandato.
- **Slug nel token JWT**: resta valido dopo un cambio; si legge dal DB.

## Impatto
- **API/DB:** nuove colonne e rotte come sopra; `openapi.json` e `schema.d.ts` da rigenerare; il login ha un parametro facoltativo (compatibile).
- **UI:** rotte nuove, schermata piattaforma, schermata utenti del ristorante, cambio password obbligatorio al primo accesso.
- **Deploy:** nessuna variabile nuova. Il contenuto del QR cambia, il vecchio resta valido.
- **Da fare nella 3c (dalla revisione di sicurezza):** `must_change_password` esiste ma non è ancora applicato (serve l'endpoint di cambio password e il blocco delle rotte dati finché non si cambia); togliere il login senza slug (3d) elimina anche i casi di ambiguità e il doppio budget di tentativi. Migration: il downgrade fallisce se due ristoranti hanno lo stesso username e cancella i SUPERADMIN; creare gli utenti con la CLI solo dopo il deploy (il codice vecchio li creerebbe senza ristorante).
- **Rischi:** una query senza filtro di ristorante = fuga di dati tra locali (mitigato da test di isolamento e da una `/code-review` dedicata); slug riservati che collidono con le rotte; promozione a superadmin da fare a mano una volta.

## Piano a task (una PR per fase)
- [x] **3a Backend e dati** (login: senza slug entra anche uno staff con username univoco, transitorio fino alla 3d; `GET /api/menu` ora è dello staff; QR invariato): modello, migration "espandi", `RestaurantContext`, filtri su tutti gli endpoint, tolto `ristorante_singolo`, test di isolamento, login con slug, CLI (`promote-superadmin`, `--restaurant`). Verifica: pytest incluso il test "due ristoranti"; `test_openapi_sync`.
- [ ] **3b Piattaforma**: API e interfaccia `/piattaforma` (ristoranti, admin dei ristoranti, attiva/disattiva). Verifica: test API e prova da interfaccia.
- [ ] **3c Utenti del ristorante e nuovi indirizzi**: API e schermata utenti, cambio password al primo accesso, rotte `/ristorante/:slug/…`, QR nuovo e redirect dei vecchi. Verifica: test frontend e QR vecchio e nuovo aperti a mano.
- [ ] **3d Restringi**: migration finale e pulizia dei redirect temporanei.

## Test e verifica
Criteri dell'intent con evidenza; test di isolamento; migration provata su una copia dei dati con un ristorante e due utenti; prova end-to-end su anteprima Vercel con due ristoranti.
