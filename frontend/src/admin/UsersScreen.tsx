import { api } from '../api/client'
import { useAuth } from '../staff/auth'
import { SectionHeader } from './parts'
import { UsersPanel, type UsersApi } from './UsersPanel'

const usersApi: UsersApi = {
  list: api.staff.users.list,
  create: api.staff.users.create,
  update: api.staff.users.update,
  resetPassword: api.staff.users.resetPassword,
  remove: api.staff.users.remove,
}

/** `/ristorante/<slug>/admin/users`: gli utenti del proprio locale (altri admin e camerieri). */
export function UsersScreen() {
  const { session } = useAuth()
  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '10px 16px' }}>
      <SectionHeader
        title="Utenti"
        sub="Chi può accedere al tuo locale: altri admin e camerieri. La password provvisoria va cambiata al primo accesso."
      />
      <UsersPanel
        queryKey={['admin', 'users', session?.restaurant ?? '']}
        api={usersApi}
        selfUsername={session?.username ?? null}
        hideTitle
      />
    </div>
  )
}
