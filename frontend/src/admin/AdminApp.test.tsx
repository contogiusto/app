import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type MenuItemOut, type StaffTable } from '../api/client'
import { AuthContext } from '../staff/auth'
import AdminApp from './AdminApp'

const mocks = vi.hoisted(() => ({
  menu: { all: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  tables: { list: vi.fn(), create: vi.fn(), regenerateQr: vi.fn(), qr: vi.fn() },
}))

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, staff: { ...original.api.staff, ...mocks } } }
})

const dish = (over: Partial<MenuItemOut> = {}): MenuItemOut => ({
  id: 1,
  name: 'Margherita',
  category: 'Primi',
  price: '8.50',
  available: true,
  ...over,
})

const MENU: MenuItemOut[] = [
  dish(),
  dish({ id: 2, name: 'Tiramisù', category: 'Dolci', price: '5.00', available: false }),
  dish({ id: 3, name: 'Bruschetta', category: 'Antipasti', price: '4.00' }),
]

const TABLES: StaffTable[] = [
  { id: 10, number: 1, open_session_id: null },
  { id: 11, number: 2, open_session_id: 99 },
]

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const auth = {
    session: { token: 't', role: 'ADMIN' as const, username: 'admin' },
    notice: null,
    login: vi.fn(),
    logout: vi.fn(),
  }
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/admin/*" element={<AdminApp />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.menu.all.mockResolvedValue(MENU)
  mocks.tables.list.mockResolvedValue(TABLES)
  mocks.tables.qr.mockResolvedValue(new Blob(['<svg/>'], { type: 'image/svg+xml' }))
  URL.createObjectURL = vi.fn(() => 'blob:qr')
  URL.revokeObjectURL = vi.fn()
  window.print = vi.fn()
})

describe('menu', () => {
  it('mostra i piatti raggruppati per categoria, anche quelli non disponibili', async () => {
    renderAt('/admin/menu')
    expect(await screen.findByText('3 piatti · 1 non disponibili')).toBeInTheDocument()
    const sections = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))
    expect(sections).toEqual(['Antipasti', 'Primi', 'Dolci'])
    expect(within(screen.getByRole('region', { name: 'Primi' })).getByText('8,50 €')).toBeInTheDocument()
    expect(screen.getByText('Non disponibile')).toBeInTheDocument()
  })

  it('la radice /admin porta al menu', async () => {
    renderAt('/admin')
    expect(await screen.findByRole('heading', { name: 'Menù', level: 2 })).toBeInTheDocument()
  })

  it('crea un piatto mandando il prezzo come stringa decimale', async () => {
    const user = userEvent.setup()
    mocks.menu.create.mockResolvedValue(dish({ id: 4 }))
    renderAt('/admin/menu')
    await user.click(await screen.findByRole('button', { name: /Nuovo piatto/ }))
    const dialog = screen.getByRole('dialog', { name: 'Nuovo piatto' })
    await user.type(within(dialog).getByLabelText('Nome'), '  Tagliolini  ')
    await user.clear(within(dialog).getByLabelText('Categoria'))
    await user.type(within(dialog).getByLabelText('Categoria'), 'Primi')
    await user.type(within(dialog).getByLabelText('Prezzo €'), '12,5')
    await user.click(within(dialog).getByRole('button', { name: 'Salva piatto' }))
    expect(mocks.menu.create).toHaveBeenCalledWith({
      name: 'Tagliolini',
      category: 'Primi',
      price: '12.50',
      available: true,
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.menu.all).toHaveBeenCalledTimes(2)
  })

  it('non invia un prezzo non valido e lo dice', async () => {
    const user = userEvent.setup()
    renderAt('/admin/menu')
    await user.click(await screen.findByRole('button', { name: /Nuovo piatto/ }))
    await user.type(screen.getByLabelText('Nome'), 'Vino')
    await user.type(screen.getByLabelText('Prezzo €'), '3.999')
    await user.click(screen.getByRole('button', { name: 'Salva piatto' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('al massimo due decimali')
    expect(mocks.menu.create).not.toHaveBeenCalled()
  })

  it('mostra l\'errore 422 del server e lascia il modulo aperto', async () => {
    const user = userEvent.setup()
    mocks.menu.create.mockRejectedValue(new ApiError(422, 'Dati non validi'))
    renderAt('/admin/menu')
    await user.click(await screen.findByRole('button', { name: /Nuovo piatto/ }))
    await user.type(screen.getByLabelText('Nome'), 'Vino')
    await user.type(screen.getByLabelText('Prezzo €'), '3')
    await user.click(screen.getByRole('button', { name: 'Salva piatto' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Dati non validi')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('modifica un piatto partendo dai suoi valori', async () => {
    const user = userEvent.setup()
    mocks.menu.update.mockResolvedValue(dish())
    renderAt('/admin/menu')
    await user.click(await screen.findByRole('button', { name: 'Modifica Margherita' }))
    expect(screen.getByLabelText('Prezzo €')).toHaveValue('8.50')
    await user.clear(screen.getByLabelText('Prezzo €'))
    await user.type(screen.getByLabelText('Prezzo €'), '9')
    await user.click(screen.getByRole('switch', { name: 'Disponibile' }))
    await user.click(screen.getByRole('button', { name: 'Salva piatto' }))
    expect(mocks.menu.update).toHaveBeenCalledWith(1, {
      name: 'Margherita',
      category: 'Primi',
      price: '9.00',
      available: false,
    })
  })

  it('l\'interruttore cambia solo la disponibilità', async () => {
    const user = userEvent.setup()
    mocks.menu.update.mockResolvedValue(dish({ available: false }))
    renderAt('/admin/menu')
    await user.click(await screen.findByRole('switch', { name: 'Disponibile: Margherita' }))
    expect(mocks.menu.update).toHaveBeenCalledWith(1, {
      name: 'Margherita',
      category: 'Primi',
      price: '8.50',
      available: false,
    })
  })

  it('elimina un piatto dopo la conferma', async () => {
    const user = userEvent.setup()
    mocks.menu.remove.mockResolvedValue(undefined)
    renderAt('/admin/menu')
    await user.click(await screen.findByRole('button', { name: 'Elimina Bruschetta' }))
    expect(mocks.menu.remove).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Elimina' }))
    expect(mocks.menu.remove).toHaveBeenCalledWith(3)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('annullando la conferma non elimina nulla', async () => {
    const user = userEvent.setup()
    renderAt('/admin/menu')
    await user.click(await screen.findByRole('button', { name: 'Elimina Bruschetta' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mocks.menu.remove).not.toHaveBeenCalled()
  })

  it('un piatto già ordinato (409) offre di renderlo non disponibile', async () => {
    const user = userEvent.setup()
    mocks.menu.remove.mockRejectedValue(
      new ApiError(409, 'Piatto già ordinato: impostalo come non disponibile invece di eliminarlo'),
    )
    mocks.menu.update.mockResolvedValue(dish({ available: false }))
    renderAt('/admin/menu')
    await user.click(await screen.findByRole('button', { name: 'Elimina Margherita' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Elimina' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Piatto già ordinato')
    expect(within(dialog).queryByRole('button', { name: 'Elimina' })).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Rendi non disponibile' }))
    expect(mocks.menu.update).toHaveBeenCalledWith(1, {
      name: 'Margherita',
      category: 'Primi',
      price: '8.50',
      available: false,
    })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('segnala un errore nel caricamento', async () => {
    mocks.menu.all.mockRejectedValue(new ApiError(0, 'Connessione assente: riprova tra poco'))
    renderAt('/admin/menu')
    expect(await screen.findByRole('alert')).toHaveTextContent('Connessione assente')
  })
})

describe('tavoli e QR', () => {
  it('elenca i tavoli con stato e QR', async () => {
    renderAt('/admin/tables')
    expect(await screen.findByText('2 tavoli · 1 occupati')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('img', { name: /QR del tavolo/ })).toHaveLength(2))
    expect(screen.getByText('Occupato')).toBeInTheDocument()
    expect(screen.getByText('Libero')).toBeInTheDocument()
    expect(mocks.tables.qr).toHaveBeenCalledWith(10)
  })

  it('crea un tavolo col numero scelto', async () => {
    const user = userEvent.setup()
    mocks.tables.create.mockResolvedValue({ id: 12, number: 12, open_session_id: null })
    renderAt('/admin/tables')
    await user.click(await screen.findByRole('button', { name: /Nuovo tavolo/ }))
    await user.type(screen.getByLabelText('Numero del tavolo'), '12')
    await user.click(screen.getByRole('button', { name: 'Crea tavolo' }))
    expect(mocks.tables.create).toHaveBeenCalledWith(12)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it.each(['0', '10000', '3.5', 'abc'])('rifiuta il numero "%s" senza chiamare l\'API', async (value) => {
    const user = userEvent.setup()
    renderAt('/admin/tables')
    await user.click(await screen.findByRole('button', { name: /Nuovo tavolo/ }))
    await user.type(screen.getByLabelText('Numero del tavolo'), value)
    await user.click(screen.getByRole('button', { name: 'Crea tavolo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('da 1 a 9999')
    expect(mocks.tables.create).not.toHaveBeenCalled()
  })

  it('mostra il 409 per un numero già usato', async () => {
    const user = userEvent.setup()
    mocks.tables.create.mockRejectedValue(new ApiError(409, 'Esiste già un tavolo con questo numero'))
    renderAt('/admin/tables')
    await user.click(await screen.findByRole('button', { name: /Nuovo tavolo/ }))
    await user.type(screen.getByLabelText('Numero del tavolo'), '1')
    await user.click(screen.getByRole('button', { name: 'Crea tavolo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Esiste già un tavolo')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('rigenera il QR solo dopo la conferma che avvisa che il vecchio smette di funzionare', async () => {
    const user = userEvent.setup()
    mocks.tables.regenerateQr.mockResolvedValue(undefined)
    renderAt('/admin/tables')
    await user.click(await screen.findByRole('button', { name: 'Rigenera il QR del tavolo 1' }))
    const dialog = screen.getByRole('alertdialog', { name: /Rigenerare il QR del tavolo 1/ })
    expect(dialog).toHaveTextContent('smetterà di funzionare')
    expect(mocks.tables.regenerateQr).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Rigenera QR' }))
    expect(mocks.tables.regenerateQr).toHaveBeenCalledWith(10)
    // Dopo la rigenerazione il QR si riscarica.
    await waitFor(() => expect(mocks.tables.qr).toHaveBeenCalledTimes(3))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('annullare la rigenerazione non tocca il QR', async () => {
    const user = userEvent.setup()
    renderAt('/admin/tables')
    await user.click(await screen.findByRole('button', { name: 'Rigenera il QR del tavolo 1' }))
    await user.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(mocks.tables.regenerateQr).not.toHaveBeenCalled()
  })

  it('mostra l\'errore se la rigenerazione fallisce', async () => {
    const user = userEvent.setup()
    mocks.tables.regenerateQr.mockRejectedValue(new ApiError(404, 'Tavolo non trovato'))
    renderAt('/admin/tables')
    await user.click(await screen.findByRole('button', { name: 'Rigenera il QR del tavolo 1' }))
    await user.click(screen.getByRole('button', { name: 'Rigenera QR' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Tavolo non trovato')
  })

  it('stampa il foglio con numero e QR del tavolo', async () => {
    const user = userEvent.setup()
    renderAt('/admin/tables')
    await user.click(await screen.findByRole('button', { name: 'Stampa il QR del tavolo 2' }))
    expect(window.print).toHaveBeenCalledTimes(1)
    const sheet = document.querySelector('.print-sheet')
    expect(sheet).not.toBeNull()
    expect(sheet).toHaveTextContent('Tavolo 2')
    expect(sheet?.querySelector('img')).toHaveAttribute('src', 'blob:qr')
    window.dispatchEvent(new Event('afterprint'))
    await waitFor(() => expect(document.querySelector('.print-sheet')).toBeNull())
  })
})
