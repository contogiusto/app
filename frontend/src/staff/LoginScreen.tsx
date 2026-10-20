import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError, type UserRole } from '../api/client'
import { Icon } from '../ui/Icon'
import { Screen } from '../ui/layout'
import { homeFor, useAuth } from './auth'

/** Il ritorno alla pagina richiesta vale solo se il ruolo può entrarci. */
function allowed(path: unknown, role: UserRole): path is string {
  if (typeof path !== 'string') return false
  if (path.startsWith('/admin')) return role === 'ADMIN'
  return path.startsWith('/waiter')
}

export default function LoginScreen() {
  const { session, notice, login } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: unknown } | null)?.from
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Già collegato (es. ricarica della pagina): niente form.
  if (session && !busy) {
    return <Navigate to={allowed(from, session.role) ? from : homeFor(session.role)} replace />
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const next = await login(username, password)
      navigate(allowed(from, next.role) ? from : homeFor(next.role), { replace: true })
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
            <Icon name="lock" size={16} style={{ color: 'var(--accent)' }} />
            <span className="eyebrow">Area staff</span>
          </div>
          <h1 className="serif" style={{ fontSize: 46, lineHeight: 0.98, marginBottom: 14 }}>
            Accedi.
          </h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.45, marginBottom: 30 }}>
            Per camerieri e ristoratori: entra con le credenziali che ti ha dato il locale.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                background: 'var(--clay-tint)',
                color: 'var(--clay-deep)',
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
        </form>
      </main>
    </Screen>
  )
}
