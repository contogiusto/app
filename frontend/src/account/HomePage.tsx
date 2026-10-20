import { Link } from 'react-router-dom'

/**
 * Segnaposto della home `/` (accesso e registrazione del cliente). Da sostituire: deve leggere
 * `?redirect=` (con `safeRedirect`, da `./redirect`) e `?mode=register`, e permettere di passare
 * all'accesso dello staff (`/staff/login`).
 */
export default function HomePage() {
  return (
    <main
      className="paper-grain"
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '0 32px',
        textAlign: 'center',
      }}
    >
      <h1 className="serif" style={{ fontSize: 44 }}>
        Conto Giusto
      </h1>
      <p style={{ color: 'var(--ink-2)', maxWidth: 360 }}>
        Ordini e pagamenti al tavolo, senza stress.
      </p>
      <Link to="/staff/login">Accesso staff</Link>
    </main>
  )
}
