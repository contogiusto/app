# 0001 — Restyling dell'interfaccia

- **Stato:** in corso
- **Data:** 2026-11-18
- **Design:** [docs/design/0001-restyling-interfaccia.md](../design/0001-restyling-interfaccia.md)
- **PR:** (da aprire)

## Problema
L'aspetto attuale (carta crema, terracotta e oliva, font serif) viene dal prototipo e non riflette l'uso reale: importi e stato del conto non sono in primo piano, i colori stanno su valori scritti a mano sparsi nei componenti e non esiste un design system documentato.

## Risultato atteso
Un'interfaccia da app di pagamento pulita ("fintech"): neutri freddi, un solo colore di accento, numeri tabulari protagonisti, gerarchia chiara, interazioni rifinite. Il tema vive in token documentati in `DESIGN.md`, usati da tutti i ruoli (cliente, account, cameriere, ristoratore).

## Criteri di successo
- [ ] Nessun colore scritto a mano nei componenti: solo token di `theme.css` (eccezione: la stampa del QR).
- [ ] `DESIGN.md` descrive colori, tipografia, spaziature, componenti e movimento, ed è coerente col codice.
- [ ] Contrasto AA per testo e componenti sui token principali; focus visibile ovunque; bersagli touch ≥ 44 px sulle azioni principali.
- [ ] `prefers-reduced-motion` rispettato; nessuna transizione su `all`.
- [ ] Controllate nel browser a 375 px e desktop: percorso cliente, account, cameriere, ristoratore.
- [ ] Lint, test e build del frontend verdi; nessun cambio di comportamento (nessuna modifica a API o logica).

## Fuori scope
Tema scuro, nuove funzioni, cambi di flusso o di copy (salvo correzioni evidenti), icone nuove, logo.

## Vincoli
Font self-hosted; nessun servizio esterno; zero costi; solo frontend.
