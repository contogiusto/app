import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import type { StaffUser, StaffUserIn, StaffUserPatch } from '../api/client'
import { Icon } from '../ui/Icon'
import { Initial } from '../ui/primitives'
import { Modal } from './Modal'
import { generatePassword } from './password'
import { ErrorNote } from './parts'

/** Le operazioni sugli utenti: l'admin centrale e l'admin del ristorante le usano su rotte diverse. */
export type UsersApi = {
  list: () => Promise<StaffUser[]>
  create: (data: StaffUserIn) => Promise<StaffUser>
  update: (id: number, data: StaffUserPatch) => Promise<StaffUser>
  resetPassword: (id: number, password: string) => Promise<void>
  remove: (id: number) => Promise<void>
}

const ROLE_LABEL = { ADMIN: 'Admin', WAITER: 'Cameriere', SUPERADMIN: 'Admin centrale' } as const

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Qualcosa non va')

type Dialog =
  | { kind: 'create' }
  | { kind: 'password'; user: StaffUser }
  | { kind: 'delete'; user: StaffUser }
  | null

/**
 * Elenco e gestione degli utenti di un ristorante: crea (con password provvisoria da cambiare al
 * primo accesso), attiva/disattiva, cambia ruolo, reimposta la password, elimina.
 * `selfUsername` è l'utente collegato (non può disattivarsi né eliminarsi da qui).
 */
export function UsersPanel({
  queryKey,
  api,
  selfUsername = null,
  hideTitle = false,
}: {
  queryKey: readonly unknown[]
  api: UsersApi
  /** Nome dell'utente collegato: non può disattivarsi, cambiarsi ruolo né eliminarsi da qui. */
  selfUsername?: string | null
  /** Se la pagina ha già il suo titolo. */
  hideTitle?: boolean
}) {
  const client = useQueryClient()
  const users = useQuery({ queryKey, queryFn: api.list })
  const [dialog, setDialog] = useState<Dialog>(null)
  const refresh = () => client.invalidateQueries({ queryKey })
  const close = () => setDialog(null)

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: StaffUserPatch }) => api.update(id, data),
    onSuccess: refresh,
  })

  if (users.isPending) return <p role="status">Caricamento degli utenti…</p>
  if (users.isError) return <ErrorNote>{messageOf(users.error)}</ErrorNote>

  return (
    <section aria-label="Utenti">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        {hideTitle ? <span /> : (
          <h3 className="display" style={{ fontSize: 20 }}>
            Utenti
          </h3>
        )}
        <button type="button" className="btn" onClick={() => setDialog({ kind: 'create' })}>
          <Icon name="plus" size={17} /> Nuovo utente
        </button>
      </div>

      {update.isError && (
        <div style={{ marginBottom: 14 }}>
          <ErrorNote>{messageOf(update.error)}</ErrorNote>
        </div>
      )}

      {users.data.length === 0 ? (
        <p style={{ color: 'var(--text-2)' }}>Nessun utente: crea il primo.</p>
      ) : (
        <ul className="card" style={{ overflow: 'hidden', listStyle: 'none', margin: 0, padding: 0 }}>
          {users.data.map((user, index) => {
            const isSelf = user.username === selfUsername
            return (
              <li
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  padding: '12px 16px',
                  borderTop: index ? '1px solid var(--border)' : 'none',
                  opacity: user.active ? 1 : 0.6,
                }}
              >
                <Initial name={user.username} size={36} />
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {user.username}
                    {isSelf && <span style={{ color: 'var(--text-3)', fontWeight: 500 }}> (tu)</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <span className="chip">{ROLE_LABEL[user.role]}</span>
                    {!user.active && <span className="chip chip--warn">Disattivato</span>}
                    {user.must_change_password && (
                      <span className="chip chip--warn">Deve cambiare la password</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ minHeight: 40, padding: '8px 12px', fontSize: 13 }}
                    disabled={isSelf || update.isPending}
                    aria-label={`${user.role === 'ADMIN' ? 'Rendi cameriere' : 'Rendi admin'} ${user.username}`}
                    onClick={() =>
                      update.mutate({ id: user.id, data: { role: user.role === 'ADMIN' ? 'WAITER' : 'ADMIN' } })
                    }
                  >
                    {user.role === 'ADMIN' ? 'Rendi cameriere' : 'Rendi admin'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ minHeight: 40, padding: '8px 12px', fontSize: 13 }}
                    disabled={isSelf || update.isPending}
                    aria-label={`${user.active ? 'Disattiva' : 'Riattiva'} ${user.username}`}
                    onClick={() => update.mutate({ id: user.id, data: { active: !user.active } })}
                  >
                    {user.active ? 'Disattiva' : 'Riattiva'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ minHeight: 40, padding: '8px 12px', fontSize: 13 }}
                    aria-label={`Reimposta la password di ${user.username}`}
                    onClick={() => setDialog({ kind: 'password', user })}
                  >
                    <Icon name="lock" size={14} /> Password
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ minHeight: 40, padding: '8px 12px', fontSize: 13 }}
                    disabled={isSelf}
                    aria-label={`Elimina ${user.username}`}
                    onClick={() => setDialog({ kind: 'delete', user })}
                  >
                    Elimina
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {dialog?.kind === 'create' && (
        <CreateUser
          api={api}
          onClose={close}
          onDone={() => {
            close()
            void refresh()
          }}
        />
      )}
      {dialog?.kind === 'password' && (
        <ResetPassword
          user={dialog.user}
          api={api}
          onClose={close}
          onDone={() => {
            close()
            void refresh()
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteUser
          user={dialog.user}
          api={api}
          onClose={close}
          onDone={() => {
            close()
            void refresh()
          }}
        />
      )}
    </section>
  )
}

/** Campo password provvisoria con il pulsante che ne propone una casuale (si copia a mano). */
function TemporaryPassword({
  value,
  onChange,
  id,
}: {
  value: string
  onChange: (value: string) => void
  id: string
}) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        Password provvisoria
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id={id}
          className="field tnum"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-hint`}
        />
        <button type="button" className="btn btn--ghost" onClick={() => onChange(generatePassword())}>
          Genera
        </button>
      </div>
      <p id={`${id}-hint`} style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 6 }}>
        Almeno 12 caratteri. Comunicala alla persona: dovrà cambiarla al primo accesso e qui non si
        potrà più rivedere.
      </p>
    </div>
  )
}

function CreateUser({ api, onClose, onDone }: { api: UsersApi; onClose: () => void; onDone: () => void }) {
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<StaffUserIn['role']>('WAITER')
  const [password, setPassword] = useState(() => generatePassword())
  const create = useMutation({
    mutationFn: () => api.create({ username: username.trim(), role, password }),
    onSuccess: onDone,
  })
  const valid = /^[A-Za-z0-9._-]{3,64}$/.test(username.trim()) && password.length >= 12

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (valid && !create.isPending) create.mutate()
  }

  return (
    <Modal title="Nuovo utente" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="field-label" htmlFor="new-username">
            Nome utente
          </label>
          <input
            id="new-username"
            className="field"
            autoComplete="off"
            autoCapitalize="none"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            aria-describedby="new-username-hint"
          />
          <p id="new-username-hint" style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 6 }}>
            3-64 caratteri: lettere, numeri, punto, trattino e trattino basso.
          </p>
        </div>
        <div>
          <label className="field-label" htmlFor="new-role">
            Ruolo
          </label>
          <select
            id="new-role"
            className="field"
            value={role}
            onChange={(event) => setRole(event.target.value as StaffUserIn['role'])}
          >
            <option value="WAITER">Cameriere</option>
            <option value="ADMIN">Admin del ristorante</option>
          </select>
        </div>
        <TemporaryPassword id="new-password" value={password} onChange={setPassword} />
        {create.isError && <ErrorNote>{messageOf(create.error)}</ErrorNote>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn" disabled={!valid || create.isPending}>
            Crea utente
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ResetPassword({
  user,
  api,
  onClose,
  onDone,
}: {
  user: StaffUser
  api: UsersApi
  onClose: () => void
  onDone: () => void
}) {
  const [password, setPassword] = useState(() => generatePassword())
  const reset = useMutation({ mutationFn: () => api.resetPassword(user.id, password), onSuccess: onDone })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (password.length >= 12 && !reset.isPending) reset.mutate()
  }
  return (
    <Modal title={`Nuova password per ${user.username}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TemporaryPassword id="reset-password" value={password} onChange={setPassword} />
        {reset.isError && <ErrorNote>{messageOf(reset.error)}</ErrorNote>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn" disabled={password.length < 12 || reset.isPending}>
            Imposta password
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DeleteUser({
  user,
  api,
  onClose,
  onDone,
}: {
  user: StaffUser
  api: UsersApi
  onClose: () => void
  onDone: () => void
}) {
  const remove = useMutation({ mutationFn: () => api.remove(user.id), onSuccess: onDone })
  return (
    <Modal title="Eliminare l'utente?" role="alertdialog" onClose={onClose}>
      <p style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>
        «{user.username}» non potrà più accedere. L'operazione non si può annullare. Se ha già
        inserito ordini, disattivalo invece di eliminarlo.
      </p>
      {remove.isError && (
        <div style={{ marginTop: 16 }}>
          <ErrorNote>{messageOf(remove.error)}</ErrorNote>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 26, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Annulla
        </button>
        <button type="button" className="btn btn--danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
          Elimina
        </button>
      </div>
    </Modal>
  )
}
