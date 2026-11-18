import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { Icon } from '../ui/Icon'
import { Logo } from '../ui/Logo'
import { Screen } from '../ui/layout'
import { homeFor, useAuth } from './auth'

const MIN_LENGTH = 12

/**
 * `/cambio-password`: chi ha una password provvisoria (scelta da chi ha creato l'utenza) deve
 * sceglierne una propria prima di usare l'app. Vale anche per chi vuole cambiarla di sua volontà.
 */
export default function ChangePasswordScreen() {
  const { session, changePassword, logout } = useAuth()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session === null) return <Navigate to="/staff/login" replace />

  const forced = session.mustChangePassword === true
  const home = homeFor(session.role, session.restaurant)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (next.length < MIN_LENGTH) {
      setError(`La nuova password deve avere almeno ${MIN_LENGTH} caratteri`)
      return
    }
    if (next !== repeat) {
      setError('Le due password nuove non coincidono')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await changePassword(current, next)
      navigate(home, { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Qualcosa è andato storto: riprova')
      setBusy(false)
    }
  }

  return (
    <Screen>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 26px' }}>
        <form onSubmit={submit} noValidate className="stagger" style={{ width: '100%', maxWidth: 380 }}>
          <Logo size={44} />
          <h1 className="display" style={{ fontSize: 28, lineHeight: 1.15, margin: '22px 0 12px' }}>
            Scegli la tua password
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 15.5, lineHeight: 1.45, marginBottom: 24 }}>
            {forced
              ? 'Hai una password provvisoria: sceglierne una tua è necessario per continuare.'
              : 'Inserisci quella attuale e scegline una nuova.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="field-label" htmlFor="current-password">
                Password attuale
              </label>
              <input
                id="current-password"
                type="password"
                className="field"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="new-password">
                Nuova password
              </label>
              <input
                id="new-password"
                type="password"
                className="field"
                autoComplete="new-password"
                aria-describedby="new-password-hint"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <p id="new-password-hint" style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 6 }}>
                Almeno {MIN_LENGTH} caratteri, diversa da quella attuale.
              </p>
            </div>
            <div>
              <label className="field-label" htmlFor="repeat-password">
                Ripeti la nuova password
              </label>
              <input
                id="repeat-password"
                type="password"
                className="field"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            </div>
          </div>
          {error && (
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
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--block btn--lg" style={{ marginTop: 22 }} disabled={busy}>
            {busy ? 'Salvataggio…' : 'Salva la password'} <Icon name="arrow" size={18} />
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginTop: 10 }}
            onClick={() => (forced ? logout() : navigate(home))}
          >
            {forced ? 'Esci' : 'Annulla'}
          </button>
        </form>
      </main>
    </Screen>
  )
}
