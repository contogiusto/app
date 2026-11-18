import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../api/client'
import { Icon } from '../ui/Icon'
import { Logo } from '../ui/Logo'
import './account.css'
import { ErrorNote, GENERIC_ERROR, InfoNote } from './parts'

/** `/password-dimenticata`: si chiede l'email e arriva il link per scegliere una nuova password. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!email.trim()) {
      setError('Inserisci la tua email.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      // La risposta è la stessa per email registrate e non: la mostriamo senza interpretarla.
      const result = await api.customer.requestPasswordReset(email.trim())
      setSent(result.detail)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : GENERIC_ERROR)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-bg acc" style={{ height: '100%', overflow: 'auto' }}>
      <main style={{ maxWidth: 420, margin: '0 auto', padding: '40px 22px 32px' }}>
        <Logo size={44} />
        <h1 className="display" style={{ fontSize: 28, lineHeight: 1.15, margin: '22px 0 12px' }}>
          Password dimenticata
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 16, lineHeight: 1.45, marginBottom: 22 }}>
          Scrivi l’email del tuo account: ti mandiamo un link per scegliere una nuova password.
        </p>

        {sent ? (
          <>
            <InfoNote>{sent}</InfoNote>
            <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.5, marginTop: 14 }}>
              Il link vale poco tempo e si usa una volta sola. Controlla anche la posta indesiderata.
            </p>
          </>
        ) : (
          <form onSubmit={submit} noValidate aria-label="Recupero password">
            <label className="field-label" htmlFor="forgot-email">
              Email
            </label>
            <input
              id="forgot-email"
              className="field"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <ErrorNote>{error}</ErrorNote>}
            <button type="submit" className="btn btn--block btn--lg" style={{ marginTop: 22 }} disabled={busy}>
              {busy ? 'Un attimo…' : 'Invia il link'} <Icon name="arrow" size={18} />
            </button>
          </form>
        )}

        <p style={{ marginTop: 28, fontSize: 14 }}>
          <Link to="/">← Torna all’accesso</Link>
        </p>
      </main>
    </div>
  )
}
