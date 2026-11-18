import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError, type UserRole } from '../api/client'
import { Icon } from '../ui/Icon'
import { Logo } from '../ui/Logo'
import { Screen } from '../ui/layout'
import { CHANGE_PASSWORD_PATH, homeFor, useAuth } from './auth'

/** Il ritorno alla pagina richiesta vale solo se il ruolo può entrarci (e resta nel suo ristorante). */
function allowed(path: unknown, role: UserRole, restaurant?: string | null): path is string {
  if (typeof path !== 'string') return false
  if (path.startsWith('/piattaforma')) return role === 'SUPERADMIN'
  const scoped = /^\/ristorante\/([^/]+)(\/.*)?$/.exec(path)
  if (scoped && scoped[1] !== restaurant) return false
  const rest = scoped ? (scoped[2] ?? '') : path
  if (rest.startsWith('/admin')) return role === 'ADMIN'
  return rest.startsWith('/waiter') && role !== 'SUPERADMIN'
}

export default function LoginScreen() {
  const { session, notice, login } = useAuth()
  const { slug } = useParams()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: unknown } | null)?.from
  const [restaurant, setRestaurant] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Già collegato (es. ricarica della pagina): niente form.
  if (session && !busy) {
    if (session.mustChangePassword) return <Navigate to={CHANGE_PASSWORD_PATH} replace />
    const target = allowed(from, session.role, session.restaurant)
      ? from
      : homeFor(session.role, session.restaurant)
    return <Navigate to={target} replace />
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      // Dal link del ristorante lo slug è nell'indirizzo; dal login generico lo scrive chi accede
      // (vuoto = admin centrale).
      const next = await login(username, password, slug ?? (restaurant.trim().toLowerCase() || undefined))
      const target = next.mustChangePassword
        ? CHANGE_PASSWORD_PATH
        : allowed(from, next.role, next.restaurant)
          ? from
          : homeFor(next.role, next.restaurant)
      navigate(target, { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Qualcosa è andato storto: riprova')
      setBusy(false)
    }
  }

  const message = error ?? notice
  return (
    <Screen>
      <main
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 26px' }}
      >
        <form onSubmit={submit} className="stagger" style={{ width: '100%', maxWidth: 380 }}>
          <Logo size={44} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '22px 0' }}>
            <Icon name="lock" size={16} style={{ color: 'var(--accent)' }} />
            <span className="eyebrow">Area staff</span>
          </div>
          <h1 className="display" style={{ fontSize: 32, lineHeight: 1.15, marginBottom: 14 }}>
            Accedi.
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 16, lineHeight: 1.45, marginBottom: 30 }}>
            Per camerieri e ristoratori: entra con le credenziali che ti ha dato il locale.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!slug && (
              <div>
                <label className="field-label" htmlFor="restaurant">
                  Ristorante (indirizzo)
                </label>
                <input
                  id="restaurant"
                  className="field"
                  autoCapitalize="none"
                  autoComplete="off"
                  placeholder="es. da-gino"
                  aria-describedby="restaurant-hint"
                  value={restaurant}
                  onChange={(e) => setRestaurant(e.target.value)}
                />
                <p id="restaurant-hint" style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 6 }}>
                  Lo trovi nel link del tuo locale. Lascialo vuoto solo se sei l’admin centrale.
                </p>
              </div>
            )}
            <div>
              <label className="field-label" htmlFor="username">
                Utente
              </label>
              <input
                id="username"
                className="field"
                autoComplete="username"
                autoCapitalize="none"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="field"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          {message && (
            <p
              role="alert"
              style={{
                margin: '14px 0 0',
                padding: '10px 14px',
                borderRadius: 'var(--r-md)',
                background: 'var(--danger-tint)',
                color: 'var(--danger-deep)',
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              {message}
            </p>
          )}
          <button
            type="submit"
            className="btn btn--block btn--lg"
            style={{ marginTop: 22 }}
            disabled={busy}
          >
            {busy ? 'Accesso…' : 'Entra'} <Icon name="arrow" size={18} />
          </button>
          <p style={{ marginTop: 22, fontSize: 14, color: 'var(--text-2)' }}>
            Sei un cliente? <Link to={slug ? `/ristorante/${slug}` : '/'}>Accesso clienti</Link>
          </p>
        </form>
      </main>
    </Screen>
  )
}
