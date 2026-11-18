# Design system — Conto Giusto

Fonte di verità del codice: [`frontend/src/styles/theme.css`](frontend/src/styles/theme.css). Questo file spiega le scelte; se cambi un token, aggiorna entrambi. Contesto di prodotto in [PRODUCT.md](PRODUCT.md); la decisione di partenza in [docs/design/0001-restyling-interfaccia.md](docs/design/0001-restyling-interfaccia.md).

## Direzione
**Fintech pulito** per un'app che si usa in sala: neutri freddi, un solo accento, il numero come protagonista. Modalità *Operate* (si completa un compito): ciò che conta è scansione veloce, coerenza e controlli noti; il carattere sta nei dettagli (tipografia, numeri, movimento), non nell'ornamento. Solo tema chiaro.

## Colore (OKLCH)
Neutri con tinta 262° (blu freddo, croma ~0.005-0.02), accento cobalto 264°. Il colore pieno compare solo per azione primaria e stati.

| Ruolo | Token | Uso |
|---|---|---|
| Sfondo / superficie | `--bg`, `--surface`, `--surface-2` | app / card e schermate / righe in rilievo |
| Testo | `--text`, `--text-2`, `--text-3` | primario / secondario / suggerimenti (≥ 4.5:1) |
| Bordi, velature | `--border`, `--border-strong`, `--wash-1/2`, `--scrim` | divisori e campi / hover / sfondo dei modali |
| Accento | `--accent`, `--accent-deep`, `--accent-tint`, `--on-accent` | azione primaria, selezione, focus, link |
| Successo | `--ok`, `--ok-deep`, `--ok-tint`, `--ok-border` | pagato, online |
| Attesa | `--warn`, `--warn-deep`, `--warn-tint` | alla cassa, da confermare |
| Errore | `--danger`, `--danger-deep`, `--danger-tint` | errori, azioni distruttive |
| Categorie/avatar | `--cat-1…6` (+ `-tint`) | punti categoria del menu, iniziali |

Regole: l'accento **non** significa mai errore o successo; gli errori usano `--danger-*`. Nessun colore scritto a mano nei componenti (eccezione: foglio di stampa del QR, bianco su nero). Contrasti verificati: testo/superficie 17.7, `--text-2` 7.8, `--text-3` 5.1, bianco su accento 6.3, coppie `-deep` su `-tint` ≥ 7.

## Tipografia
**Geist Variable** (self-hosted, `@fontsource-variable/geist`), un'unica famiglia. Titoli `.display` (600, tracking −0.02em), corpo 16 px / 1.45. Etichette dei campi 13 px/600; `.eyebrow` 12 px maiuscolo. **Gli importi usano sempre `.tnum`** (cifre tabulari) così le colonne di cifre si allineano e non "ballano" al polling. Scala dei titoli usata: 34 (home), 28-32 (schermata), 20-24 (sezione), importo principale 44.

## Forme e profondità
Raggi: 8 (`--r-sm`), 10 (`--r-md`, bottoni e campi), 16 (`--r-lg`, card), 22, pillola solo per chip. Ombre quasi invisibili: la separazione la fanno bordi da 1 px; `--shadow-lg` solo per modali.

## Componenti
- **Bottone** `.btn` (+ `--lg`, `--ghost`, `--dark`, `--olive` = successo, `--danger`, `--block`): minimo 44 px, `:active` scale .97, hover solo con puntatore preciso.
- **Campo** `.field`: 16 px (niente zoom su iOS), bordo 1 px, focus con anello `--accent-tint`; **etichetta** `.field-label`.
- **Card** `.card`, **chip** `.chip` (`--accent`, `--ok`, `--warn`, `--text`), **bottone icona** `.iconbtn` (40 px).
- Primitive e layout condivisi in `frontend/src/ui/`; modali in `admin/Modal.tsx` e `waiter/parts.tsx`.
- **Card in evidenza** `.card--hero`: accento pieno con bagliore, testo bianco, bottone bianco; **una sola per schermata**, per la cifra che conta (la quota da pagare).
- **Elementi premibili** `.pressable`: bordo accento e sollevamento in hover (solo puntatore preciso), `scale(.985)` in pressione.
- **Finestre modali** `.modal-backdrop` / `.modal-panel`: al centro su desktop, *bottom sheet* con maniglia su telefono (≤ 560 px). Il pannello del cameriere scorre da destra.
- **Barre** `.glass` (intestazioni, navigazione in basso): superficie traslucida con sfocatura.
- **Marchio** `ui/Logo.tsx` (tondo diviso a metà) e `public/favicon.svg`.

## Movimento
Principio: il movimento serve a orientarsi (da dove arriva una schermata), a confermare (pressione, pagamento riuscito) e a far notare un cambio (importo che si aggiorna). Il caso raro e positivo, il pagamento riuscito, è l'unico con una celebrazione (anello, segno che si disegna, coriandoli); le azioni frequenti del cameriere restano quasi istantanee.
- **Cambio di passo** `.step` (cliente): dissolvenza + 10 px dal basso, .34 s.
- **Importi** `<Money animate>`: conteggio ease-out 450 ms quando il valore cambia; non parte al primo render, con movimento ridotto né nei test.
- **Scheletri** `.skeleton` per i caricamenti dove si conosce la forma.
Ease-out forte `--ease` (cubic-bezier .23,1,.32,1). Durate: feedback di pressione .16 s, ingressi .26-.3 s, mai oltre. Si animano solo `transform`, `opacity` e colori, mai `all`. `prefers-reduced-motion` azzera tutto. Il polling non deve provocare animazioni (solo `.flash` quando un valore cambia davvero).

## Accessibilità
Focus visibile uniforme (`:focus-visible`, 2 px accento); bersagli ≥ 44 px per le azioni principali; messaggi d'errore con `role="alert"`; nessuna informazione solo a colore (gli stati hanno etichetta).

## Cosa non fare
Gradienti decorativi (l'unico gradiente è quello di `.card--hero` e il bagliore di `.app-bg`), texture, ombre colorate su elementi non primari, accento su stati di errore/successo, importi in proporzionali, nuove font, colori hex nei componenti.
