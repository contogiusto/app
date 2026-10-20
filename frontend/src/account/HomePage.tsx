import { useState, type FormEvent, type InputHTMLAttributes, type KeyboardEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { Icon } from '../ui/Icon'
import { useAccount } from './account'
import './account.css'
import { ErrorNote, GENERIC_ERROR, InfoNote } from './parts'
import { safeRedirect } from './redirect'

type Mode = 'login' | 'register'

const PASSWORD_MIN = 8
const PASSWORD_MAX = 128

/**
 * Home `/`: accesso e registrazione del cliente. Legge `?redirect=` (sempre con `safeRedirect`:
 * può essere un tavolo con il suo `?token=`, quindi la query si conserva per intero) e
 * `?mode=register`. L'account non serve per pagare al tavolo: l'ospite esiste.
 */
export default function HomePage() {
  const { session, notice } = useAccount()
  const [params] = useSearchParams()
  const to = safeRedirect(params.get('redirect'))
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login')
  const [busy, setBusy] = useState(false)

  // Già collegato (es. ricarica della pagina): niente form.
  if (session && !busy) return <Navigate to={to} replace />

  const onTabKey = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = mode === 'login' ? 'register' : 'login'
    setMode(next)
    document.getElementById(`tab-${next}`)?.focus()
  }

  return (
    <div className="paper-grain acc" style={{ height: '100%', overflow: 'auto' }}>
      <main style={{ maxWidth: 420, margin: '0 auto', padding: '40px 22px 32px' }}>
        <span className="eyebrow">Il tuo account</span>
        <h1 className="serif" style={{ fontSize: 52, lineHeight: 0.98, margin: '10px 0 12px' }}>
          Conto Giusto
        </h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.45, marginBottom: 22 }}>
          Con un account ritrovi i tuoi pagamenti nello storico. Per pagare al tavolo, invece,
          l’account non serve: puoi sempre continuare come ospite.
        </p>

        {notice && <InfoNote>{notice}</InfoNote>}

        <div
          role="tablist"
          aria-label="Accesso o registrazione"
          className="acc-tabs"
          style={{ margin: '18px 0 20px' }}
        >
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              id={`tab-${m}`}
              aria-selected={mode === m}
              aria-controls="panel"
              tabIndex={mode === m ? 0 : -1}
              className="acc-tab"
              onClick={() => setMode(m)}
              onKeyDown={onTabKey}
            >
              {m === 'login' ? 'Accedi' : 'Registrati'}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="panel" aria-labelledby={`tab-${mode}`}>
          {mode === 'login' ? (
            <LoginForm to={to} busy={busy} setBusy={setBusy} />
          ) : (
            <RegisterForm to={to} busy={busy} setBusy={setBusy} />
          )}
        </div>

        <p style={{ marginTop: 28, fontSize: 14, color: 'var(--ink-2)' }}>
          Lavori in un locale?{' '}
          <Link to="/staff/login" style={{ fontWeight: 700 }}>
            Accesso staff
          </Link>
        </p>
        <p style={{ marginTop: 8, fontSize: 14 }}>
          <Link to="/privacy">Informativa sulla privacy</Link>
        </p>
      </main>
    </div>
  )
}

type FormProps = { to: string; busy: boolean; setBusy: (busy: boolean) => void }

const errorMessage = (error: unknown) => (error instanceof ApiError ? error.message : GENERIC_ERROR)

function Field({
  id,
  label,
  hint,
  ...input
}: { id: string; label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field"
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...input}
      />
      {hint && (
        <div id={`${id}-hint`} style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 5 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

function SubmitButton({ busy, children }: { busy: boolean; children: string }) {
  return (
    <button
      type="submit"
      className="btn btn--block btn--lg"
      style={{ marginTop: 22 }}
      disabled={busy}
    >
      {busy ? 'Un attimo…' : children} <Icon name="arrow" size={18} />
    </button>
  )
}

function LoginForm({ to, busy, setBusy }: FormProps) {
  const { login } = useAccount()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!email.trim() || !password) {
      setError('Inserisci email e password.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      navigate(to, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Accedi">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <SubmitButton busy={busy}>Accedi</SubmitButton>
    </form>
  )
}

function RegisterForm({ to, busy, setBusy }: FormProps) {
  const { register } = useAccount()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [city, setCity] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [privacy, setPrivacy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validate(): string | null {
    if (!firstName.trim() || !lastName.trim()) return 'Inserisci nome e cognome.'
    if (!email.trim()) return 'Inserisci la tua email.'
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      return `La password deve avere da ${PASSWORD_MIN} a ${PASSWORD_MAX} caratteri.`
    }
    if (!privacy) return 'Per registrarti conferma di aver letto l’informativa sulla privacy.'
    return null
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        city: city.trim() || null,
        email,
        password,
        accept_privacy: true,
      })
      navigate(to, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Registrati">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field
          id="reg-first-name"
          label="Nome"
          autoComplete="given-name"
          maxLength={100}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Field
          id="reg-last-name"
          label="Cognome"
          autoComplete="family-name"
          maxLength={100}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <Field
          id="reg-city"
          label="Città (facoltativa)"
          autoComplete="address-level2"
          maxLength={100}
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <Field
          id="reg-email"
          label="Email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          id="reg-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          hint={`Da ${PASSWORD_MIN} a ${PASSWORD_MAX} caratteri.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5, lineHeight: 1.4 }}>
          <input
            id="reg-privacy"
            type="checkbox"
            checked={privacy}
            onChange={(e) => setPrivacy(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 1, accentColor: 'var(--accent)', flexShrink: 0 }}
          />
          <label htmlFor="reg-privacy">
            Ho letto l’
            <Link to="/privacy" target="_blank" rel="noopener">
              informativa sulla privacy
            </Link>
            <span style={VISUALLY_HIDDEN}> (si apre in una nuova scheda)</span>
          </label>
        </div>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <SubmitButton busy={busy}>Crea account</SubmitButton>
    </form>
  )
}

const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const
