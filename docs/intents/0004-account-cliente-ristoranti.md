# 0004 — Account cliente: password dimenticata e ristoranti visitati

- **Stato:** completato (manca la prova con un'email vera: serve il dominio su Resend)
- **Data:** 2026-11-18
- **Design:** [docs/design/0004-account-cliente-ristoranti.md](../design/0004-account-cliente-ristoranti.md)
- **Dipende da:** [0003](0003-multi-ristorante.md) (gli indirizzi dei ristoranti)

## Problema
Un cliente che dimentica la password perde l'account (nessun recupero: scelta presa quando non c'era invio email). Inoltre l'app non dice al cliente **in quali ristoranti ha pagato** e scansionare un QR non lo porta "dentro" quel ristorante.

## Risultato atteso
- Il cliente riceve per email un link per scegliere una nuova password.
- Il cliente vede i **ristoranti in cui ha pagato** (ultima visita, numero di visite, totale) e, per ognuno, il proprio storico.
- Inquadrando il QR di un tavolo il cliente arriva alla pagina di **quel ristorante preciso** (`/ristorante/<slug>/tavolo/<id>`), con il suo account già pronto se è collegato.

## Criteri di successo
- [ ] Da "Password dimenticata?" si richiede il link; la risposta è identica per email registrate e non (nessuna enumerazione) ed è limitata per IP e per email.
- [ ] Il link vale 1 ora e una sola volta; dopo il cambio, il link e **tutti i token di accesso emessi prima** non funzionano più.
- [ ] L'email parte davvero (fornitore scelto, mittente verificato); in sviluppo il link si legge nel log senza servizi esterni.
- [ ] "I tuoi ristoranti" elenca solo i ristoranti dove il cliente ha pagato, con link al ristorante; lo storico si filtra per ristorante.
- [ ] Il QR (nuovo e vecchio formato) apre il tavolo nel ristorante giusto; uno slug che non corrisponde al tavolo non porta mai in un altro locale.
- [ ] L'informativa privacy e `CLAUDE.md` riflettono il trattamento (email, fornitore) e il recupero password.

## Fuori scope
Verifica dell'email alla registrazione, login Google, altre notifiche email (ricevute, promemoria), recupero password dello staff (lo fa l'admin: vedi 0003).

## Vincoli
Zero costi ricorrenti se possibile. **Servizio email:** Resend ha un piano gratuito (100 email/giorno), ma per scrivere a destinatari qualsiasi serve un **dominio proprio verificato** (SPF/DKIM): è un'azione e un possibile costo esterni, da decidere prima di costruire. Dati personali: il fornitore va nell'informativa.
