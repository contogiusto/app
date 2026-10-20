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
    <div className="paper-grain acc" style={{ height: '100%', overflow: 'auto' }}>
      <main className="acc-prose" style={{ maxWidth: 680, margin: '0 auto', padding: '32px 22px 48px' }}>
        <Link to="/">← Torna all’accesso</Link>
        <h1 className="serif" style={{ fontSize: 42, lineHeight: 1, margin: '18px 0 8px' }}>
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
            Per limitare i tentativi ripetuti di accesso, per un breve periodo teniamo un contatore
            associato all’indirizzo IP e all’email usati.
          </li>
        </ul>

        <h2>Perché li usiamo</h2>
        <p>
          Per creare e gestire il tuo account e per mostrarti lo storico dei tuoi pagamenti. Non
          usiamo i dati per pubblicità, profilazione o invio di messaggi promozionali, e non li
          vendiamo.
        </p>

        <h2>Per quanto tempo li conserviamo</h2>
        <p>
          Finché il tuo account esiste. Quando lo elimini dal profilo, cancelliamo email, nome,
          cognome, città e l’accesso. I pagamenti già effettuati restano perché servono al
          ristorante per i suoi conti, ma non sono più collegati a te. Il nome indicato al tavolo
          resta associato al singolo pagamento.
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
          <li>Hosting dell’applicazione: Vercel.</li>
          <li>Database: Neon (PostgreSQL), con i dati in Europa.</li>
        </ul>

        <h2>Nessuna verifica dell’email</h2>
        <p>
          Non inviamo email: non verifichiamo l’indirizzo e non esiste il recupero della password.
          Conserva con cura la tua password.
        </p>
      </main>
    </div>
  )
}
