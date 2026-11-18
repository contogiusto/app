# 0004 — Account cliente (design)

- **Intent:** [docs/intents/0004-account-cliente-ristoranti.md](../intents/0004-account-cliente-ristoranti.md)
- **Stato:** bozza, da approvare (dipende da 0003 per gli slug)
- **ADR da scrivere:** invio email con Resend; recupero password via link.

## Contesto
`app/routers/customer.py` ha registrazione, login (rate limit per IP e email), profilo, storico, eliminazione; `CLAUDE.md` dichiara "nessuna verifica email né recupero password" (scelta di prodotto, da aggiornare). Il token cliente è un JWT da 30 giorni (`typ=customer`). I pagamenti legano `customer_id` (null per gli ospiti); il ristorante di un pagamento si ricava da pagamento → sessione → tavolo → ristorante. Frontend: `src/account/` (home, storico, profilo, `HomePage` con accesso e registrazione), `src/scanner/parseTableLink.ts`.

## Approccio

### Password dimenticata
- Tabella `password_reset_token` (`id`, `customer_id`, `token_hash` = SHA-256 del token, `expires_at` = +1 h, `used_at`, `created_at`). Il token in chiaro (32 byte casuali, URL-safe) esiste solo nell'email.
- `POST /api/customer/password-reset/request {email}` → **sempre 202** con lo stesso corpo. Se l'email esiste, crea il token e invia l'email; rate limit per IP e per email con `app/ratelimit.py` (contano tutte le richieste). Tempi di risposta simili con e senza account (invio in `BackgroundTasks`).
- `POST /api/customer/password-reset/confirm {token, password}` → controlla hash, scadenza e uso; imposta la password (8-128 caratteri, come oggi), marca il token usato e invalida gli altri token dello stesso cliente.
- **Invalidare i token di accesso emessi prima**: nuova colonna `customer.password_changed_at`; `get_current_customer` rifiuta i JWT con `iat` precedente. Vale anche per il cambio password dal profilo.
- Invio: `app/email.py` con `send_email(to, subject, text)`: Resend via HTTPS (`httpx`) se `RESEND_API_KEY` ed `EMAIL_FROM` sono impostate; altrimenti scrive il link nel log (sviluppo e test). Nessun segreto nel codice (`.env.example`).
- Frontend: link "Password dimenticata?" in `HomePage` → form email → messaggio neutro; pagina `/reset-password` che legge il token dall'URL, lo toglie dalla barra con `history.replaceState` e chiede la nuova password. Dopo il cambio: accesso. Il token non finisce in log né in `Referer` (`Referrer-Policy: no-referrer` sulla pagina).
- Cambio password dal profilo (password attuale + nuova): utile e condivide il codice.

### Ristoranti visitati
- `GET /api/customer/restaurants` → ristoranti dove il cliente ha pagamenti `COMPLETED` o `CASH`: `slug`, `name`, `visits` (sessioni distinte), `last_visit`, `total_paid`. `GET /api/customer/payments?restaurant=<slug>` filtra lo storico. Solo dati del cliente collegato.
- Frontend: sezione "I tuoi ristoranti" in `AccountHome`; lo storico ha un filtro per ristorante; ogni ristorante porta a `/ristorante/:slug`.

### QR → ristorante preciso
- Il QR passa a `/ristorante/<slug>/tavolo/<id>?token=` (vedi 0003). `parseTableLink` valida stessa origine, percorso esatto (nuovo e vecchio), slug nel formato ammesso e `token` non vuoto; naviga sempre col router. La pagina del tavolo confronta lo slug dell'URL con quello restituito dal server per il tavolo: se non coincide, reindirizza allo slug corretto (mai ai dati di un altro ristorante).
- Con account collegato, "Stai pagando come …" e, dopo il pagamento, il ristorante compare subito in "I tuoi ristoranti".

### Privacy
`PrivacyPage` e finestra di eliminazione devono dire lo stesso (regola già in `CLAUDE.md`): l'email serve anche al recupero password e passa da un fornitore (Resend, Stati Uniti: garanzie da far rivedere al titolare). Eliminare l'account cancella i token di reset.

## Alternative scartate
- **Codice dato dal ristorante**: nessun servizio esterno ma richiede di essere al ristorante; scartato dall'utente.
- **Domande di sicurezza**: debole.
- **Reset senza invalidare i token vecchi**: lascia valida per 30 giorni una sessione eventualmente rubata.
- **Ristoranti visitati anche per gli ospiti**: non c'è un'identità su cui basarsi.

## Impatto
- **API/DB:** tabella `password_reset_token`, colonna `customer.password_changed_at` (nullable: compatibile col codice precedente); 4 endpoint nuovi e 1 filtro; OpenAPI e tipi da rigenerare.
- **Deploy:** nuove variabili `RESEND_API_KEY`, `EMAIL_FROM` (Production e Preview), **dominio verificato su Resend**; `.env.example`.
- **Rischi:** deliverability (SPF/DKIM), abuso dell'endpoint per spedire email (rate limit), enumerazione (risposta uniforme), fornitore nell'informativa.

## Piano a task
- [ ] 1. **Decisione fornitore e dominio** (azione tua: dominio e account Resend). Verifica: email di prova consegnata.
- [ ] 2. Backend: `app/email.py`, tabella token, `request`/`confirm`, `password_changed_at` e controllo `iat`, rate limit. Test-first: token scaduto, usato o inesistente, risposta uniforme, invalidazione dei vecchi token, limiti.
- [ ] 3. Frontend: "Password dimenticata?", `/reset-password`, cambio password dal profilo.
- [ ] 4. Backend e frontend: ristoranti visitati e filtro storico (dopo 0003a).
- [ ] 5. QR e `parseTableLink` con controllo dello slug (dopo 0003c).
- [ ] 6. Informativa, `CLAUDE.md`, `docs/domain.md`.

## Test e verifica
Criteri dell'intent con evidenza; prova reale con un'email vera su anteprima; test su `parseTableLink` con link ostili (altro dominio, slug sbagliato, percorsi con `..`).
