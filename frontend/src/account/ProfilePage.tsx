import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Modal } from '../admin/Modal'
import { ApiError, api, type CustomerUpdate } from '../api/client'
import { useAccount } from './account'
import { ErrorNote, GENERIC_ERROR, InfoNote } from './parts'

export const ACCOUNT_DELETED_NOTICE = 'Il tuo account è stato eliminato.'

const message = (error: unknown) => (error instanceof ApiError ? error.message : GENERIC_ERROR)

/** /customer/profile: dati personali modificabili, uscita ed eliminazione dell'account. */
export default function ProfilePage() {
  const { session, logout } = useAccount()
  const [deleting, setDeleting] = useState(false)
  if (!session) return null
  return (
    <div>
      <h1 className="display" style={{ fontSize: 28, lineHeight: 1.15, marginBottom: 20 }}>
        Profilo
      </h1>
      <DataForm />
      <PasswordForm />

      <section className="card" style={{ padding: 20, marginTop: 28 }}>
        <h2 className="display" style={{ fontSize: 20, marginBottom: 6 }}>
          Esci
        </h2>
        <p style={{ color: 'var(--text-2)', fontSize: 14.5, marginBottom: 14 }}>
          Esci da questo dispositivo. Potrai rientrare con email e password.
        </p>
        <button type="button" className="btn btn--ghost" onClick={() => logout()}>
          Esci
        </button>
      </section>

      <section className="card" style={{ padding: 20, marginTop: 16, borderColor: 'var(--danger)' }}>
        <h2 className="display" style={{ fontSize: 20, marginBottom: 6 }}>
          Elimina account
        </h2>
        <p style={{ color: 'var(--text-2)', fontSize: 14.5, marginBottom: 14, lineHeight: 1.5 }}>
          Cancella i tuoi dati personali e il tuo accesso. Non si può annullare.{' '}
          <Link to="/privacy" target="_blank" rel="noopener">
            Informativa sulla privacy
          </Link>
        </p>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => setDeleting(true)}
        >
          Elimina il mio account…
        </button>
      </section>

      {deleting && <DeleteDialog onClose={() => setDeleting(false)} />}
    </div>
  )
}

function DataForm() {
  const { session, setCustomer } = useAccount()
  const customer = session!.customer
  const [firstName, setFirstName] = useState(customer.first_name)
  const [lastName, setLastName] = useState(customer.last_name)
  const [city, setCity] = useState(customer.city ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = useMutation({ mutationFn: (data: CustomerUpdate) => api.customer.update(data) })
  const dirty =
    firstName.trim() !== customer.first_name ||
    lastName.trim() !== customer.last_name ||
    city.trim() !== (customer.city ?? '')

  const edit = (set: (value: string) => void) => (value: string) => {
    set(value)
    setSaved(false)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (save.isPending) return
    setSaved(false)
    if (!firstName.trim() || !lastName.trim()) {
      setError('Nome e cognome non possono essere vuoti.')
      return
    }
    setError(null)
    try {
      const updated = await save.mutateAsync({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        city: city.trim() || null,
      })
      setCustomer(updated)
      setSaved(true)
    } catch (e) {
      setError(message(e))
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label="I tuoi dati" className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="field-label" htmlFor="p-first-name">
            Nome
          </label>
          <input
            id="p-first-name"
            className="field"
            autoComplete="given-name"
            maxLength={100}
            value={firstName}
            onChange={(e) => edit(setFirstName)(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="p-last-name">
            Cognome
          </label>
          <input
            id="p-last-name"
            className="field"
            autoComplete="family-name"
            maxLength={100}
            value={lastName}
            onChange={(e) => edit(setLastName)(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="p-city">
            Città (facoltativa)
          </label>
          <input
            id="p-city"
            className="field"
            autoComplete="address-level2"
            maxLength={100}
            value={city}
            onChange={(e) => edit(setCity)(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="p-email">
            Email
          </label>
          <input
            id="p-email"
            className="field"
            readOnly
            aria-describedby="p-email-hint"
            value={customer.email}
            style={{ background: 'var(--wash-1)', color: 'var(--text-2)' }}
          />
          <div id="p-email-hint" style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 5 }}>
            L’email è il tuo accesso e non si può modificare.
          </div>
        </div>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {saved && <InfoNote>Dati salvati.</InfoNote>}
      <button
        type="submit"
        className="btn"
        style={{ marginTop: 18 }}
        disabled={!dirty || save.isPending}
      >
        {save.isPending ? 'Salvataggio…' : 'Salva modifiche'}
      </button>
    </form>
  )
}

function DeleteDialog({ onClose }: { onClose: () => void }) {
  const { logout } = useAccount()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const remove = useMutation({ mutationFn: (password: string) => api.customer.remove(password) })

  async function confirm(event: FormEvent) {
    event.preventDefault()
    if (remove.isPending) return
    if (!password) {
      setError('Inserisci la password per confermare.')
      return
    }
    setError(null)
    try {
      await remove.mutateAsync(password)
      queryClient.removeQueries({ queryKey: ['customer'] })
      logout(ACCOUNT_DELETED_NOTICE)
      // La guardia dell'area, vista l'uscita, manda al login con il ritorno al profilo: di un
      // account che non esiste più. Si torna quindi alla home pulita, senza ritorno.
      navigate('/', { replace: true })
    } catch (e) {
      setError(message(e))
    }
  }

  return (
    <Modal title="Eliminare l’account?" role="alertdialog" onClose={onClose}>
      <form onSubmit={confirm} noValidate>
        <p style={{ fontSize: 14.5, lineHeight: 1.5, marginBottom: 10 }}>
          <strong>Viene cancellato:</strong> il tuo nome, cognome, città, email, l’accesso con la
          password e gli eventuali link di recupero password. Non potrai più entrare.
        </p>
        <p style={{ fontSize: 14.5, lineHeight: 1.5, marginBottom: 16, color: 'var(--text-2)' }}>
          <strong>Resta:</strong> i pagamenti già fatti, ma non più collegati a te e con il nome
          sostituito da «Cliente eliminato»: servono al ristorante per i suoi conti. Il tuo storico
          non sarà più consultabile.
        </p>
        <label className="field-label" htmlFor="delete-password">
          Password
        </label>
        <input
          id="delete-password"
          type="password"
          className="field"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <ErrorNote>{error}</ErrorNote>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={remove.isPending}>
            Annulla
          </button>
          <button
            type="submit"
            className="btn btn--danger"
            disabled={remove.isPending}
          >
            {remove.isPending ? 'Eliminazione…' : 'Elimina definitivamente'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const PASSWORD_MIN = 8
const PASSWORD_MAX = 128

function PasswordForm() {
  const { changePassword } = useAccount()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setDone(false)
    if (!current) {
      setError('Inserisci la password attuale.')
      return
    }
    if (next.length < PASSWORD_MIN || next.length > PASSWORD_MAX) {
      setError(`La nuova password deve avere da ${PASSWORD_MIN} a ${PASSWORD_MAX} caratteri.`)
      return
    }
    if (next !== repeat) {
      setError('Le due password nuove non coincidono.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setRepeat('')
      setDone(true)
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Cambia password" className="card" style={{ padding: 20, marginTop: 16 }}>
      <h2 className="display" style={{ fontSize: 20, marginBottom: 14 }}>
        Cambia password
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="field-label" htmlFor="pw-current">
            Password attuale
          </label>
          <input id="pw-current" className="field" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="pw-new">
            Nuova password
          </label>
          <input id="pw-new" className="field" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="pw-repeat">
            Ripeti la nuova password
          </label>
          <input id="pw-repeat" className="field" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </div>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {done && <InfoNote>Password cambiata.</InfoNote>}
      <button type="submit" className="btn" style={{ marginTop: 18 }} disabled={busy}>
        {busy ? 'Salvataggio…' : 'Cambia password'}
      </button>
    </form>
  )
}
