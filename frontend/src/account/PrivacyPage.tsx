import { Link } from 'react-router-dom'
import './account.css'
import { PRIVACY_CONFIG, type PrivacyConfig } from './privacyConfig'

const TBD = 'da indicare'

/**
 * `/privacy`: informativa sui dati dell'account cliente. Descrive ciò che l'app fa davvero (vedi
 * `backend/app/models.py` e `routers/customer.py`): se il comportamento cambia, va aggiornata.
 * I dati del titolare vengono da `privacyConfig.ts`.
 */
export default function PrivacyPage({ config = PRIVACY_CONFIG }: { config?: PrivacyConfig }) {
  return (
    <div className="app-bg acc" style={{ height: '100%', overflow: 'auto' }}>
      <main className="acc-prose" style={{ maxWidth: 680, margin: '0 auto', padding: '32px 22px 48px' }}>
        <Link to="/">← Torna all’accesso</Link>
        <h1 className="display" style={{ fontSize: 30, lineHeight: 1.15, margin: '18px 0 8px' }}>
          Informativa sulla privacy
        </h1>
        <p>
          Riguarda i dati dell’<strong>account cliente</strong> di Conto Giusto. Se paghi al tavolo
          come ospite, senza account, non registriamo alcun dato che ti identifichi.
        </p>
        <p>Ultimo aggiornamento: {config.updatedAt || TBD}.</p>

        <h2>Chi tratta i dati</h2>
        <p>
          <strong>Titolare del trattamento:</strong> {config.controllerName || TBD}
          {config.controllerAddress && <>, {config.controllerAddress}</>}.
        </p>
        <p>
          <strong>Contatto per i tuoi diritti:</strong>{' '}
          {config.contactEmail ? (
            <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
          ) : (
            TBD
          )}
          .
        </p>

        <p>
          <strong>Chi riceve i dati dei pagamenti:</strong> i ristoranti dove paghi vedono i dati
          dei pagamenti fatti al loro tavolo (importo, data e ora, tavolo, piatti, nome indicato) e
          li usano per i propri conti, come titolari autonomi. Se hai un account, quei pagamenti
          compaiono anche nel tuo storico.
        </p>

        <h2>Quali dati raccogliamo</h2>
        <ul>
          <li>Email, nome e cognome, e la città (solo se la indichi: è facoltativa).</li>
          <li>
            La password: la conserviamo solo in forma di <em>hash</em> (non leggibile), mai in
            chiaro.
          </li>
          <li>
            Lo storico dei tuoi pagamenti al tavolo da collegato: importo, data e ora, ristorante,
            tavolo, metodo e stato del pagamento, piatti.
          </li>
          <li>Il nome che indichi al tavolo quando paghi.</li>
          <li>
            Se chiedi di recuperare la password, un link a scadenza spedito alla tua email: di
            quel link conserviamo solo un codice non leggibile (<em>hash</em>), non il link.
          </li>
          <li>
            Per limitare i tentativi ripetuti di accesso e le richieste di recupero password,
            teniamo per un’ora al massimo un contatore associato all’indirizzo IP e all’email usati.
          </li>
        </ul>

        <h2>Perché li usiamo</h2>
        <p>
          Per creare e gestire il tuo account, per mostrarti lo storico dei tuoi pagamenti e per
          farti recuperare la password. Non usiamo i dati per pubblicità, profilazione o invio di
          messaggi promozionali, e non li vendiamo. Base giuridica: l’esecuzione del servizio che
          richiedi quando crei e usi l’account.
        </p>

        <h2>Per quanto tempo li conserviamo</h2>
        <p>
          Finché il tuo account esiste. Quando lo elimini dal profilo, cancelliamo email, nome,
          cognome, città, l’accesso e gli eventuali link di recupero password. I link scaduti non
          sono più utilizzabili e il sistema li ripulisce; di ciascuno resta comunque solo un codice
          non leggibile. I pagamenti già effettuati restano perché servono al
          ristorante per i suoi conti, ma non sono più collegati a te, e il nome che avevi indicato
          al tavolo su quei pagamenti viene sostituito con «Cliente eliminato». I pagamenti fatti
          da ospite, senza account, non sono collegati a nessun account e restano com’erano.
        </p>

        <h2>I tuoi diritti</h2>
        <p>
          Puoi modificare nome, cognome e città e <strong>eliminare l’account</strong> in autonomia
          dalla pagina Profilo. Per gli altri diritti previsti dalla legge (per esempio accesso ai
          dati o reclamo all’autorità di controllo) rivolgiti al titolare ai recapiti indicati sopra.
        </p>

        <h2>Cosa salva il browser</h2>
        <p>
          Quando accedi, il browser conserva nel <em>localStorage</em> il tuo accesso (un token e i
          dati del profilo) per non chiederti la password a ogni visita: lo cancelli con “Esci”.
          Non usiamo cookie di tracciamento né strumenti di statistica.
        </p>

        <h2>Chi ospita i dati</h2>
        <ul>
          <li>
            Hosting dell’applicazione: Vercel
            {config.hostingRegion ? <> (regione: {config.hostingRegion})</> : null}.
          </li>
          <li>
            Database: Neon (PostgreSQL), regione: {config.databaseRegion || TBD}.
          </li>
          <li>
            Invio delle email (solo per il recupero della password): Resend, con sede negli Stati
            Uniti. Riceve il tuo indirizzo email e il testo del messaggio.
          </li>
        </ul>

        <h2>Email e recupero della password</h2>
        <p>
          Quando ti registri non verifichiamo che l’email sia tua. Se dimentichi la password puoi
          chiedere un link dalla pagina di accesso: lo spediamo all’email dell’account, vale un’ora
          e una sola volta, e dopo averlo usato i vecchi accessi non funzionano più. La risposta alla
          richiesta è sempre la stessa, anche se l’email non è registrata.
        </p>

        <h2>Se lavori in un ristorante</h2>
        <p>
          Chi lavora in un locale (cameriere, admin) ha un accesso con nome utente, password (solo
          come <em>hash</em>), ruolo e ristorante, creato dal locale. Registriamo quali ordini ha
          inserito, per i conti del ristorante. Il titolare di questi dati è il ristorante; per
          modificarli o cancellarli rivolgiti a lui.
        </p>
      </main>
    </div>
  )
}
