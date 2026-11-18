# 0003 — Più ristoranti, admin centrale e gestione utenti

- **Stato:** proposto
- **Data:** 2026-11-18
- **Design:** [docs/design/0003-multi-ristorante.md](../design/0003-multi-ristorante.md)
- **PR:** (a fasi, vedi il piano nel design)

## Problema
L'app è a ristorante singolo: menu e tavoli appartengono al primo `Restaurant` (`ristorante_singolo`), gli utenti staff si creano solo da riga di comando e non esiste una figura che gestisca più locali.

## Risultato atteso
- Un **admin centrale** (oggi l'unico admin) gestisce **più ristoranti** da interfaccia: li crea, li attiva/disattiva e crea e gestisce l'utenza admin di ciascuno.
- Ogni ristorante vive al **suo indirizzo** (`/ristorante/<slug>`) con il proprio menu, i propri tavoli e il proprio staff, completamente separati dagli altri.
- L'**admin di ristorante**, oltre a menu e tavoli, gestisce da interfaccia gli **utenti del proprio locale** (altri admin e camerieri).

## Criteri di successo
- [ ] L'admin centrale crea un ristorante e il suo primo admin da interfaccia, senza CLI.
- [ ] Ogni dato (menu, tavoli, sessioni, ordini, pagamenti) appartiene a un ristorante; un utente di un ristorante non vede né modifica nulla di un altro (test di isolamento su **ogni** endpoint: id di altri ristoranti → 404).
- [ ] L'admin di ristorante crea, disattiva, reimposta la password ed elimina utenti del proprio locale; non può eliminare né declassare sé stesso, né l'ultimo admin.
- [ ] Il QR di un tavolo porta a `/ristorante/<slug>/tavolo/<id>?token=…`; i QR già stampati (`/table/<id>?token=…`) continuano a funzionare.
- [ ] I dati esistenti migrano senza perdite nel primo ristorante; gli admin attuali diventano admin centrali.
- [ ] Migration compatibile col codice precedente (ADR 0002).

## Fuori scope
Sottodomini per ristorante, fatturazione/piani, personalizzazione grafica per locale, statistiche aggregate, un utente staff che lavora su più ristoranti, impersonificazione dell'admin centrale nei dati di un locale.

## Vincoli
Zero costi (Vercel Hobby + Neon); stesso database per tutti i ristoranti (multi-tenant a colonna `restaurant_id`); nessuna password di default.
