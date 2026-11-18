import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { api, type Restaurant } from '../api/client'
import { Modal } from '../admin/Modal'
import { ErrorNote, SectionHeader, Toggle } from '../admin/parts'
import { UsersPanel, type UsersApi } from '../admin/UsersPanel'
import { StaffLayout } from '../staff/StaffLayout'
import { Icon } from '../ui/Icon'
import { slugFromName } from './slug'

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Qualcosa non va')
const RESTAURANTS = ['platform', 'restaurants'] as const

/** Pannello dell'admin centrale: ristoranti e loro utenti, montato su `/piattaforma/*`. */
export default function PlatformApp() {
  return (
    <StaffLayout title="Piattaforma">
      <Routes>
        <Route index element={<RestaurantList />} />
        <Route path=":restaurantId" element={<RestaurantDetail />} />
        <Route path="*" element={<Navigate to="/piattaforma" replace />} />
      </Routes>
    </StaffLayout>
  )
}

function RestaurantList() {
  const restaurants = useQuery({ queryKey: RESTAURANTS, queryFn: api.staff.platform.restaurants })
  const [creating, setCreating] = useState(false)

  if (restaurants.isPending) return <p role="status">Caricamento dei ristoranti…</p>
  if (restaurants.isError) return <ErrorNote>{messageOf(restaurants.error)}</ErrorNote>

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '10px 16px' }}>
      <SectionHeader
        title="Ristoranti"
        sub={`${restaurants.data.length} ${restaurants.data.length === 1 ? 'locale' : 'locali'}`}
        action={
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            <Icon name="plus" size={17} /> Nuovo ristorante
          </button>
        }
      />
      {restaurants.data.length === 0 ? (
        <p style={{ color: 'var(--text-2)' }}>Nessun ristorante: creane uno e il suo primo admin.</p>
      ) : (
        <ul className="card" style={{ overflow: 'hidden', listStyle: 'none', margin: 0, padding: 0 }}>
          {restaurants.data.map((r, index) => (
            <li key={r.id} style={{ borderTop: index ? '1px solid var(--border)' : 'none' }}>
              <Link
                to={`/piattaforma/${r.id}`}
                className="pressable"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  color: 'inherit',
                  textDecoration: 'none',
                  opacity: r.active ? 1 : 0.6,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: 13 }}>/ristorante/{r.slug}</div>
                </div>
                {!r.active && <span className="chip chip--warn">Disattivato</span>}
                <span className="chip">
                  {r.users} {r.users === 1 ? 'utente' : 'utenti'}
                </span>
                <Icon name="arrow" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating && <CreateRestaurant onClose={() => setCreating(false)} />}
    </div>
  )
}

function CreateRestaurant({ onClose }: { onClose: () => void }) {
  const client = useQueryClient()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const create = useMutation({
    mutationFn: () => api.staff.platform.createRestaurant({ name: name.trim(), slug }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: RESTAURANTS })
      onClose()
    },
  })
  const valid = name.trim().length > 0 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (valid && !create.isPending) create.mutate()
  }

  return (
    <Modal title="Nuovo ristorante" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="field-label" htmlFor="rest-name">
            Nome
          </label>
          <input
            id="rest-name"
            className="field"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (!slugTouched) setSlug(slugFromName(event.target.value))
            }}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="rest-slug">
            Indirizzo
          </label>
          <input
            id="rest-slug"
            className="field"
            autoCapitalize="none"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true)
              setSlug(event.target.value.toLowerCase())
            }}
            aria-describedby="rest-slug-hint"
          />
          <p id="rest-slug-hint" style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 6 }}>
            Sarà /ristorante/{slug || 'indirizzo'}. Lettere minuscole, numeri e trattini (3-40).
          </p>
        </div>
        {create.isError && <ErrorNote>{messageOf(create.error)}</ErrorNote>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn" disabled={!valid || create.isPending}>
            Crea ristorante
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RestaurantDetail() {
  const { restaurantId } = useParams()
  const id = Number(restaurantId)
  const restaurants = useQuery({ queryKey: RESTAURANTS, queryFn: api.staff.platform.restaurants })

  if (!Number.isInteger(id)) return <Navigate to="/piattaforma" replace />
  if (restaurants.isPending) return <p role="status">Caricamento…</p>
  if (restaurants.isError) return <ErrorNote>{messageOf(restaurants.error)}</ErrorNote>
  const restaurant = restaurants.data.find((r) => r.id === id)
  if (!restaurant) return <Navigate to="/piattaforma" replace />

  const usersApi: UsersApi = {
    list: () => api.staff.platform.users(id),
    create: (data) => api.staff.platform.createUser(id, data),
    update: (userId, data) => api.staff.platform.updateUser(id, userId, data),
    resetPassword: (userId, password) => api.staff.platform.resetUserPassword(id, userId, password),
    remove: (userId) => api.staff.platform.removeUser(id, userId),
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '10px 16px' }}>
      <Link to="/piattaforma" style={{ color: 'var(--text-2)', fontSize: 14 }}>
        ← Tutti i ristoranti
      </Link>
      <RestaurantSettings restaurant={restaurant} />
      <UsersPanel queryKey={['platform', 'users', id]} api={usersApi} />
    </div>
  )
}

function RestaurantSettings({ restaurant }: { restaurant: Restaurant }) {
  const client = useQueryClient()
  const [name, setName] = useState(restaurant.name)
  const [slug, setSlug] = useState(restaurant.slug)
  const update = useMutation({
    mutationFn: (data: { name?: string; slug?: string; active?: boolean }) =>
      api.staff.platform.updateRestaurant(restaurant.id, data),
    onSuccess: () => client.invalidateQueries({ queryKey: RESTAURANTS }),
  })
  const changed = name.trim() !== restaurant.name || slug !== restaurant.slug

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (changed && !update.isPending) update.mutate({ name: name.trim(), slug })
  }

  return (
    <section aria-label="Dati del ristorante" style={{ margin: '14px 0 30px' }}>
      <SectionHeader
        title={restaurant.name}
        sub={`/ristorante/${restaurant.slug}`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {restaurant.active ? 'Attivo' : 'Disattivato'}
            </span>
            <Toggle
              on={restaurant.active}
              label={restaurant.active ? 'Disattiva il ristorante' : 'Riattiva il ristorante'}
              disabled={update.isPending}
              onChange={(active) => update.mutate({ active })}
            />
          </div>
        }
      />
      {!restaurant.active && (
        <p style={{ color: 'var(--text-2)', marginBottom: 14 }}>
          Disattivato: lo staff non può accedere e i clienti non raggiungono i suoi tavoli.
        </p>
      )}
      <form onSubmit={submit} className="card" style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <label className="field-label" htmlFor="edit-name">
            Nome
          </label>
          <input id="edit-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="edit-slug">
            Indirizzo
          </label>
          <input
            id="edit-slug"
            className="field"
            autoCapitalize="none"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            aria-describedby="edit-slug-hint"
          />
          <p id="edit-slug-hint" style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 6 }}>
            Cambiare l'indirizzo cambia il link del ristorante e i QR che lo contengono.
          </p>
        </div>
        {update.isError && <ErrorNote>{messageOf(update.error)}</ErrorNote>}
        <div>
          <button type="submit" className="btn" disabled={!changed || update.isPending}>
            Salva
          </button>
        </div>
      </form>
    </section>
  )
}
