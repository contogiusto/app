import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type Restaurant, type StaffUser } from '../api/client'
import { AuthContext } from '../staff/auth'
import PlatformApp from './PlatformApp'
import { slugFromName } from './slug'

const mocks = vi.hoisted(() => ({
  platform: {
    restaurants: vi.fn(),
    createRestaurant: vi.fn(),
    updateRestaurant: vi.fn(),
    users: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    resetUserPassword: vi.fn(),
    removeUser: vi.fn(),
  },
}))

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, staff: { ...original.api.staff, ...mocks } } }
})

const restaurant = (over: Partial<Restaurant> = {}): Restaurant => ({
  id: 1,
  name: 'Da Gino',
  slug: 'da-gino',
  active: true,
  created_at: '2026-11-18T10:00:00Z',
  users: 2,
  ...over,
})

const user = (over: Partial<StaffUser> = {}): StaffUser => ({
  id: 10,
  username: 'mario',
  role: 'ADMIN',
  active: true,
  must_change_password: false,
  ...over,
})

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const auth = {
    session: { token: 't', role: 'SUPERADMIN' as const, username: 'capo' },
    notice: null,
    login: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
  }
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/piattaforma/*" element={<PlatformApp />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.platform.restaurants.mockResolvedValue([restaurant(), restaurant({ id: 2, name: 'Da Lia', slug: 'da-lia', active: false, users: 1 })])
  mocks.platform.users.mockResolvedValue([user(), user({ id: 11, username: 'luigi', role: 'WAITER', must_change_password: true })])
})

describe('slugFromName', () => {
  it('toglie accenti e simboli', () => {
    expect(slugFromName("Caffè dell'Angolo!")).toBe('caffe-dell-angolo')
    expect(slugFromName('  Da   Gino  ')).toBe('da-gino')
    expect(slugFromName('!!')).toBe('')
  })
})

describe('elenco ristoranti', () => {
  it('mostra i locali con indirizzo, stato e numero di utenti', async () => {
    renderAt('/piattaforma')
    expect(await screen.findByRole('link', { name: /Da Gino/ })).toHaveAttribute('href', '/piattaforma/1')
    expect(screen.getByText('/ristorante/da-gino')).toBeInTheDocument()
    expect(screen.getByText('Disattivato')).toBeInTheDocument()
    expect(screen.getByText('2 utenti')).toBeInTheDocument()
  })

  it('crea un ristorante proponendo l’indirizzo dal nome', async () => {
    mocks.platform.createRestaurant.mockResolvedValue(restaurant({ id: 3, name: 'Caffè Centrale', slug: 'caffe-centrale' }))
    const ui = userEvent.setup()
    renderAt('/piattaforma')
    await ui.click(await screen.findByRole('button', { name: /Nuovo ristorante/ }))
    const dialog = screen.getByRole('dialog', { name: 'Nuovo ristorante' })
    await ui.type(within(dialog).getByLabelText('Nome'), 'Caffè Centrale')
    expect(within(dialog).getByLabelText('Indirizzo')).toHaveValue('caffe-centrale')
    await ui.click(within(dialog).getByRole('button', { name: 'Crea ristorante' }))
    await waitFor(() =>
      expect(mocks.platform.createRestaurant).toHaveBeenCalledWith({ name: 'Caffè Centrale', slug: 'caffe-centrale' }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('mostra l’errore del server (indirizzo già usato)', async () => {
    mocks.platform.createRestaurant.mockRejectedValue(new ApiError(409, 'Questo indirizzo è già usato da un altro ristorante'))
    const ui = userEvent.setup()
    renderAt('/piattaforma')
    await ui.click(await screen.findByRole('button', { name: /Nuovo ristorante/ }))
    const dialog = screen.getByRole('dialog')
    await ui.type(within(dialog).getByLabelText('Nome'), 'Da Gino')
    await ui.click(within(dialog).getByRole('button', { name: 'Crea ristorante' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('già usato')
  })

  it('non abilita "Crea" con un indirizzo non valido', async () => {
    const ui = userEvent.setup()
    renderAt('/piattaforma')
    await ui.click(await screen.findByRole('button', { name: /Nuovo ristorante/ }))
    const dialog = screen.getByRole('dialog')
    await ui.type(within(dialog).getByLabelText('Nome'), 'Da Gino')
    const slug = within(dialog).getByLabelText('Indirizzo')
    await ui.clear(slug)
    await ui.type(slug, 'Brutto Slug')
    expect(within(dialog).getByRole('button', { name: 'Crea ristorante' })).toBeDisabled()
  })
})

describe('dettaglio di un ristorante', () => {
  it('mostra dati e utenti', async () => {
    renderAt('/piattaforma/1')
    expect(await screen.findByRole('heading', { name: 'Da Gino' })).toBeInTheDocument()
    expect(await screen.findByText('mario')).toBeInTheDocument()
    expect(screen.getByText('Deve cambiare la password')).toBeInTheDocument()
  })

  it('disattiva il ristorante', async () => {
    mocks.platform.updateRestaurant.mockResolvedValue(restaurant({ active: false }))
    const ui = userEvent.setup()
    renderAt('/piattaforma/1')
    await ui.click(await screen.findByRole('switch', { name: 'Disattiva il ristorante' }))
    expect(mocks.platform.updateRestaurant).toHaveBeenCalledWith(1, { active: false })
  })

  it('crea un utente con password provvisoria generata', async () => {
    mocks.platform.createUser.mockResolvedValue(user({ id: 12, username: 'anna', role: 'WAITER' }))
    const ui = userEvent.setup()
    renderAt('/piattaforma/1')
    await ui.click(await screen.findByRole('button', { name: /Nuovo utente/ }))
    const dialog = screen.getByRole('dialog', { name: 'Nuovo utente' })
    const password = (within(dialog).getByLabelText('Password provvisoria') as HTMLInputElement).value
    expect(password.length).toBeGreaterThanOrEqual(12)
    await ui.type(within(dialog).getByLabelText('Nome utente'), 'anna')
    await ui.click(within(dialog).getByRole('button', { name: 'Crea utente' }))
    await waitFor(() =>
      expect(mocks.platform.createUser).toHaveBeenCalledWith(1, { username: 'anna', role: 'WAITER', password }),
    )
  })

  it('cambia ruolo e disattiva un utente', async () => {
    mocks.platform.updateUser.mockResolvedValue(user())
    const ui = userEvent.setup()
    renderAt('/piattaforma/1')
    await ui.click(await screen.findByRole('button', { name: 'Rendi cameriere mario' }))
    expect(mocks.platform.updateUser).toHaveBeenCalledWith(1, 10, { role: 'WAITER' })
    await ui.click(screen.getByRole('button', { name: 'Disattiva luigi' }))
    expect(mocks.platform.updateUser).toHaveBeenCalledWith(1, 11, { active: false })
  })

  it('mostra l’errore dell’ultimo admin', async () => {
    mocks.platform.updateUser.mockRejectedValue(new ApiError(409, "È l'ultimo admin attivo del ristorante: creane prima un altro"))
    const ui = userEvent.setup()
    renderAt('/piattaforma/1')
    await ui.click(await screen.findByRole('button', { name: 'Disattiva mario' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ultimo admin')
  })

  it('reimposta la password', async () => {
    mocks.platform.resetUserPassword.mockResolvedValue(undefined)
    const ui = userEvent.setup()
    renderAt('/piattaforma/1')
    await ui.click(await screen.findByRole('button', { name: 'Reimposta la password di luigi' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuova password per luigi' })
    await ui.click(within(dialog).getByRole('button', { name: 'Imposta password' }))
    await waitFor(() =>
      expect(mocks.platform.resetUserPassword).toHaveBeenCalledWith(1, 11, expect.stringMatching(/^.{12,}$/)),
    )
  })

  it('elimina un utente dopo la conferma, o spiega perché non si può', async () => {
    mocks.platform.removeUser.mockRejectedValueOnce(new ApiError(409, 'Ha già inserito ordini: disattivalo invece di eliminarlo'))
    const ui = userEvent.setup()
    renderAt('/piattaforma/1')
    await ui.click(await screen.findByRole('button', { name: 'Elimina luigi' }))
    const dialog = screen.getByRole('alertdialog')
    await ui.click(within(dialog).getByRole('button', { name: 'Elimina' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('disattivalo')
    mocks.platform.removeUser.mockResolvedValueOnce(undefined)
    await ui.click(within(dialog).getByRole('button', { name: 'Elimina' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('un ristorante inesistente riporta all’elenco', async () => {
    renderAt('/piattaforma/999')
    expect(await screen.findByRole('heading', { name: 'Ristoranti' })).toBeInTheDocument()
  })
})
