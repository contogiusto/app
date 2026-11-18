import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError, api } from '../api/client'
import { Icon } from '../ui/Icon'
import { Logo } from '../ui/Logo'
import './account.css'
import { ErrorNote, GENERIC_ERROR } from './parts'
import { PASSWORD_RESET_DONE_NOTICE, tokenFromHash } from './resetToken'

const PASSWORD_MIN = 8
const PASSWORD_MAX = 128

/**
 * `/reset-password#token=…`: la pagina a cui porta il link dell'email. Legge il token e lo toglie
 * subito dalla barra degli indirizzi (resta solo in memoria), poi chiede la nuova password.
 */
export default function ResetPasswordPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [token] = useState(() => tokenFromHash(location.hash))
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (location.hash) window.history.replaceState(null, '', location.pathname + location.search)
  }, [location.hash, location.pathname, location.search])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || token === null) return
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      setError(`La password deve avere da ${PASSWORD_MIN} a ${PASSWORD_MAX} caratteri.`)
      return
    }
    if (password !== repeat) {
      setError('Le due password non coincidono.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.customer.confirmPasswordReset(token, password)
      navigate('/', { replace: true, state: { notice: PASSWORD_RESET_DONE_NOTICE } })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : GENERIC_ERROR)
      setBusy(false)
    }
  }

  return (
    <div className="app-bg acc" style={{ height: '100%', overflow: 'auto' }}>
      <main style={{ maxWidth: 420, margin: '0 auto', padding: '40px 22px 32px' }}>
        <meta name="referrer" content="no-referrer" />
        <Logo size={44} />
        <h1 className="display" style={{ fontSize: 28, lineHeight: 1.15, margin: '22px 0 12px' }}>
          Scegli una nuova password
        </h1>

        {token === null ? (
          <>
            <ErrorNote>Il link non è completo: aprilo di nuovo dall’email o richiedine uno nuovo.</ErrorNote>
            <p style={{ marginTop: 18 }}>
              <Link to="/password-dimenticata">Richiedi un nuovo link</Link>
            </p>
          </>
        ) : (
          <form onSubmit={submit} noValidate aria-label="Scelta della nuova password">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label" htmlFor="reset-password">
                  Nuova password
                </label>
                <input
                  id="reset-password"
                  className="field"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 5 }}>
                  Da {PASSWORD_MIN} a {PASSWORD_MAX} caratteri.
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="reset-repeat">
                  Ripeti la password
                </label>
                <input
                  id="reset-repeat"
                  className="field"
                  type="password"
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                />
              </div>
            </div>
            {error && (
              <>
                <ErrorNote>{error}</ErrorNote>
                <p style={{ marginTop: 10, fontSize: 14 }}>
                  <Link to="/password-dimenticata">Richiedi un nuovo link</Link>
                </p>
              </>
            )}
            <button type="submit" className="btn btn--block btn--lg" style={{ marginTop: 22 }} disabled={busy}>
              {busy ? 'Un attimo…' : 'Salva la password'} <Icon name="arrow" size={18} />
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
