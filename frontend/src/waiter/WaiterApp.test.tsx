import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  type MenuItemOut,
  type OpenSession,
  type OrderList,
  type PaymentList,
  type PaymentOut,
  type StaffSession,
  type StaffTable,
} from '../api/client'
import WaiterApp from './WaiterApp'

const mocks = vi.hoisted(() => ({
  tables: vi.fn(),
  listOpen: vi.fn(),
  openSession: vi.fn(),
  getSession: vi.fn(),
  closeSession: vi.fn(),
  orders: vi.fn(),
  addOrder: vi.fn(),
  removeOrder: vi.fn(),
  payments: vi.fn(),
  confirmCash: vi.fn(),
  menu: vi.fn(),
}))

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return {
    ...original,
    api: {
      ...original.api,
      menu: mocks.menu,
      staff: {
        ...original.api.staff,
        tables: { ...original.api.staff.tables, list: mocks.tables },
        sessions: {
          ...original.api.staff.sessions,
          listOpen: mocks.listOpen,
          open: mocks.openSession,
          get: mocks.getSession,
          close: mocks.closeSession,
        },
        orders: { list: mocks.orders, add: mocks.addOrder, remove: mocks.removeOrder },
        payments: {
          ...original.api.staff.payments,
          list: mocks.payments,
          confirmCash: mocks.confirmCash,
        },
      },
    },
  }
})

// La barra con utente ed "Esci" ha i suoi test: qui basta il contenuto.
vi.mock('../staff/StaffLayout', () => ({
  StaffLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const tables: StaffTable[] = [
  { id: 1, number: 1, open_session_id: null },
  { id: 2, number: 2, open_session_id: 20 },
  { id: 3, number: 3, open_session_id: 30 },
]

const summary = (over: Partial<OpenSession> = {}): OpenSession => ({
  id: 20,
  table_id: 2,
  coperti: 4,
  payment_mode: 'ROMANA',
  total: '40.00',
  paid_total: '10.00',
  cash_pending: 0,
  ...over,
})

const sessionOut = (over: Partial<StaffSession> = {}): StaffSession => ({
  id: 20,
  table_id: 2,
  status: 'OPEN',
  coperti: 4,
  payment_mode: 'ROMANA',
  total: '40.00',
  ...over,
})

const orderList: OrderList = {
  items: [
    { id: 1, menu_item_id: 11, name: 'Margherita', quantity: 2, unit_price: '8.00', line_total: '16.00' },
    { id: 2, menu_item_id: 12, name: 'Birra', quantity: 3, unit_price: '8.00', line_total: '24.00' },
  ],
  total: '40.00',
}

const payments = (over: Partial<PaymentList> = {}): PaymentList => ({
  items: [],
  paid_total: '0.00',
  remaining: '40.00',
  ...over,
})

const online: PaymentOut = {
  id: 5,
  session_id: 20,
  amount: '10.00',
  mode: 'ROMANA',
  method: 'ONLINE',
  status: 'COMPLETED',
  customer_nickname: 'Anna Russo',
}
const cash: PaymentOut = {
  ...online,
  id: 6,
  method: 'CASH',
  status: 'CASH',
  customer_nickname: 'Luca Bianchi',
}

const menu: MenuItemOut[] = [
  { id: 11, name: 'Margherita', category: 'Pizze', price: '8.00', available: true },
  { id: 12, name: 'Birra', category: 'Bevande', price: '5.50', available: true },
  { id: 13, name: 'Tiramisù', category: 'Dolci', price: '6.00', available: false },
]

function renderAt(path = '/waiter') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/waiter/*" element={<WaiterApp />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset())
  mocks.tables.mockResolvedValue(tables)
  mocks.listOpen.mockResolvedValue([
    summary(),
    summary({
      id: 30,
      table_id: 3,
      coperti: 2,
      payment_mode: null,
      total: '0.00',
      paid_total: '0.00',
      cash_pending: 2,
    }),
  ])
  mocks.getSession.mockResolvedValue(sessionOut())
  mocks.orders.mockResolvedValue(orderList)
  mocks.payments.mockResolvedValue(payments())
  mocks.menu.mockResolvedValue(menu)
})

describe('elenco tavoli', () => {
  it('mostra liberi e occupati, con coperti, pagato e contanti da confermare', async () => {
    renderAt()
    const free = await screen.findByRole('link', { name: /Tavolo 1/ })
    expect(free).toHaveTextContent('Libero')
    const busy = await screen.findByRole('link', { name: /Tavolo 2, 4 coperti/ })
    expect(busy).toHaveTextContent('25%')
    expect(busy).not.toHaveTextContent('contanti da confermare')
    expect(screen.getByRole('link', { name: /Tavolo 3/ })).toHaveTextContent(
      '2 contanti da confermare',
    )
  })

  it('riporta l’errore di caricamento con role=alert', async () => {
    mocks.tables.mockRejectedValue(new ApiError(500, 'Errore del server (500)'))
    renderAt()
    expect(await screen.findByRole('alert')).toHaveTextContent('Errore del server (500)')
  })

  it('un tavolo inesistente nell’indirizzo non rompe la pagina', async () => {
    renderAt('/waiter/table/99')
    expect(await screen.findByText('Tavolo non trovato')).toBeInTheDocument()
  })
})

describe('apertura della sessione', () => {
  it('su un tavolo libero apre la sessione con i coperti scelti', async () => {
    mocks.openSession.mockResolvedValue(
      sessionOut({ id: 11, table_id: 1, coperti: 3, payment_mode: null }),
    )
    const user = userEvent.setup()
    renderAt()
    await user.click(await screen.findByRole('link', { name: /Tavolo 1/ }))
    expect(await screen.findByRole('heading', { name: 'Apri una sessione' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aggiungi coperti' }))
    await user.click(screen.getByRole('button', { name: /Apri sessione · 3 coperti/ }))
    expect(mocks.openSession).toHaveBeenCalledWith(1, 3)
  })

  it('se un collega ha già aperto il tavolo mostra il 409 e aggiorna l’elenco', async () => {
    mocks.openSession.mockRejectedValue(new ApiError(409, 'Il tavolo ha già una sessione aperta'))
    const user = userEvent.setup()
    renderAt('/waiter/table/1')
    await user.click(await screen.findByRole('button', { name: /Apri sessione/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Il tavolo ha già una sessione aperta',
    )
    await waitFor(() => expect(mocks.tables.mock.calls.length).toBeGreaterThan(1))
  })
})

describe('sessione aperta', () => {
  it('mostra comanda, totale e stato del conto', async () => {
    mocks.payments.mockResolvedValue(payments({ paid_total: '10.00', remaining: '30.00' }))
    renderAt('/waiter/table/2')
    expect(await screen.findByRole('heading', { name: 'Tavolo 2' })).toBeInTheDocument()
    expect(await screen.findByText('Margherita')).toBeInTheDocument()
    expect(screen.getByText('2×')).toBeInTheDocument()
    expect(screen.getByText('3×')).toBeInTheDocument()
    expect(screen.getByText('Alla romana')).toBeInTheDocument()
    expect(screen.getByText('4 coperti')).toBeInTheDocument()
    const bill = await screen.findByRole('group', { name: 'Conto' })
    expect(within(bill).getByText(/40,00/)).toBeInTheDocument()
    expect(within(bill).getByText(/10,00/)).toBeInTheDocument()
    expect(within(bill).getByText(/30,00/)).toBeInTheDocument()
  })

  it('con la modalità ancora da scegliere lo dice', async () => {
    mocks.getSession.mockResolvedValue(sessionOut({ payment_mode: null }))
    renderAt('/waiter/table/2')
    expect(await screen.findByText('Modalità da scegliere')).toBeInTheDocument()
  })

  it('senza ordini né pagamenti mostra i messaggi vuoti', async () => {
    mocks.orders.mockResolvedValue({ items: [], total: '0.00' })
    renderAt('/waiter/table/2')
    expect(await screen.findByText(/Nessun piatto/)).toBeInTheDocument()
    expect(screen.getByText('Ancora nessun pagamento.')).toBeInTheDocument()
  })
})

describe('comanda', () => {
  it('aggiunge un piatto con la quantità scelta, solo tra quelli disponibili', async () => {
    mocks.addOrder.mockResolvedValue({})
    const user = userEvent.setup()
    renderAt('/waiter/table/2')
    await user.click(await screen.findByRole('button', { name: /Aggiungi ordine/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Aggiungi alla comanda' })
    expect(await within(dialog).findByText('Margherita')).toBeInTheDocument()
    expect(within(dialog).queryByText('Tiramisù')).toBeNull()
    const more = within(dialog).getByRole('button', { name: 'Aggiungi quantità Margherita' })
    await user.click(more)
    await user.click(more)
    await user.click(
      within(dialog).getByRole('button', { name: 'Aggiungi alla comanda: Margherita' }),
    )
    await waitFor(() => expect(mocks.addOrder).toHaveBeenCalledWith(20, 11, 3))
    expect(await within(dialog).findByRole('status')).toHaveTextContent('3 × Margherita')
  })

  it('filtra per categoria', async () => {
    const user = userEvent.setup()
    renderAt('/waiter/table/2')
    await user.click(await screen.findByRole('button', { name: /Aggiungi ordine/ }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('Birra')
    await user.click(within(dialog).getByRole('button', { name: 'Bevande' }))
    expect(within(dialog).queryByText('Margherita')).toBeNull()
    expect(within(dialog).getByText('Birra')).toBeInTheDocument()
  })

  it('mostra il 409 del server quando i pagamenti sono già partiti', async () => {
    mocks.addOrder.mockRejectedValue(
      new ApiError(409, 'Ci sono già pagamenti: gli ordini non si possono più modificare'),
    )
    const user = userEvent.setup()
    renderAt('/waiter/table/2')
    await user.click(await screen.findByRole('button', { name: /Aggiungi ordine/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(
      await within(dialog).findByRole('button', { name: 'Aggiungi alla comanda: Birra' }),
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'gli ordini non si possono più modificare',
    )
  })

  it('Esc chiude la scheda del menu', async () => {
    const user = userEvent.setup()
    renderAt('/waiter/table/2')
    await user.click(await screen.findByRole('button', { name: /Aggiungi ordine/ }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('rimuove una voce', async () => {
    mocks.removeOrder.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderAt('/waiter/table/2')
    await user.click(await screen.findByRole('button', { name: 'Rimuovi Birra' }))
    expect(mocks.removeOrder).toHaveBeenCalledWith(20, 2)
  })

  it('mostra il 409 se la voce è già stata pagata', async () => {
    mocks.removeOrder.mockRejectedValue(new ApiError(409, 'La voce è già stata pagata'))
    const user = userEvent.setup()
    renderAt('/waiter/table/2')
    await user.click(await screen.findByRole('button', { name: 'Rimuovi Birra' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La voce è già stata pagata')
  })

  it('con pagamenti già registrati blocca aggiunte e rimozioni', async () => {
    mocks.payments.mockResolvedValue(
      payments({ items: [online], paid_total: '10.00', remaining: '30.00' }),
    )
    renderAt('/waiter/table/2')
    expect(await screen.findByText(/non si possono più modificare/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aggiungi ordine/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rimuovi Birra' })).toBeDisabled()
  })
})

describe('pagamenti', () => {
  it('elenca importo, metodo e stato e propone la conferma solo per i contanti', async () => {
    mocks.payments.mockResolvedValue(
      payments({ items: [online, cash], paid_total: '20.00', remaining: '20.00' }),
    )
    renderAt('/waiter/table/2')
    const list = await screen.findByRole('list', { name: 'Pagamenti' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Anna Russo')
    expect(rows[0]).toHaveTextContent('Online')
    expect(rows[0]).toHaveTextContent('Incassato')
    expect(within(rows[0]).queryByRole('button')).toBeNull()
    expect(rows[1]).toHaveTextContent('Alla cassa')
    expect(
      within(rows[1]).getByRole('button', { name: 'Conferma contanti di Luca Bianchi' }),
    ).toBeInTheDocument()
  })

  it('conferma i contanti', async () => {
    mocks.payments.mockResolvedValue(
      payments({ items: [cash], paid_total: '10.00', remaining: '30.00' }),
    )
    mocks.confirmCash.mockResolvedValue({ ...cash, status: 'COMPLETED' })
    const user = userEvent.setup()
    renderAt('/waiter/table/2')
    await user.click(
      await screen.findByRole('button', { name: 'Conferma contanti di Luca Bianchi' }),
    )
    expect(mocks.confirmCash).toHaveBeenCalledWith(6)
  })

  it('mostra l’errore se la conferma fallisce', async () => {
    mocks.payments.mockResolvedValue(
      payments({ items: [cash], paid_total: '10.00', remaining: '30.00' }),
    )
    mocks.confirmCash.mockRejectedValue(new ApiError(409, 'Il pagamento non è in attesa alla cassa'))
    const user = userEvent.setup()
    renderAt('/waiter/table/2')
    await user.click(
      await screen.findByRole('button', { name: 'Conferma contanti di Luca Bianchi' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Il pagamento non è in attesa alla cassa',
    )
  })
})

describe('chiusura forzata', () => {
  it('chiede conferma esplicita e non chiude se si annulla', async () => {
    mocks.payments.mockResolvedValue(payments({ paid_total: '10.00', remaining: '30.00' }))
    const user = userEvent.setup()
    renderAt('/waiter/table/2')
    await user.click(await screen.findByRole('button', { name: 'Chiudi sessione' }))
    const dialog = screen.getByRole('alertdialog', { name: /Chiudere il tavolo 2/ })
    expect(dialog).toHaveTextContent('non si può annullare')
    await waitFor(() => expect(dialog).toHaveTextContent('30,00'))
    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mocks.closeSession).not.toHaveBeenCalled()
  })

  it('chiude la sessione dopo la conferma e la lascia visibile in sola lettura', async () => {
    mocks.closeSession.mockImplementation(async () => {
      mocks.tables.mockResolvedValue([tables[0], { id: 2, number: 2, open_session_id: null }, tables[2]])
      mocks.getSession.mockResolvedValue(sessionOut({ status: 'CLOSED' }))
      return sessionOut({ status: 'CLOSED' })
    })
    const user = userEvent.setup()
    renderAt('/waiter/table/2')
    await user.click(await screen.findByRole('button', { name: 'Chiudi sessione' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Chiudi sessione' }),
    )
    await waitFor(() => expect(mocks.closeSession).toHaveBeenCalledWith(20))
    expect(await screen.findByText('Chiusa')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chiudi sessione' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Aggiungi ordine/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Torna al tavolo' })).toBeInTheDocument()
  })

  it('mostra l’errore del server dentro la finestra di conferma', async () => {
    mocks.closeSession.mockRejectedValue(new ApiError(409, 'La sessione è già chiusa'))
    const user = userEvent.setup()
    renderAt('/waiter/table/2')
    await user.click(await screen.findByRole('button', { name: 'Chiudi sessione' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Chiudi sessione' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('La sessione è già chiusa')
  })
})
