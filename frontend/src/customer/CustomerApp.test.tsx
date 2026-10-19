import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type PublicSession, type PublicTable } from '../api/client'
import { CustomerApp } from './CustomerApp'

const mocks = vi.hoisted(() => ({
  view: vi.fn(),
  setMode: vi.fn(),
  pay: vi.fn(),
}))

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, table: mocks } }
})

const session = (over: Partial<PublicSession> = {}): PublicSession => ({
  id: 7,
  status: 'OPEN',
  coperti: 4,
  payment_mode: null,
  total: '40.00',
  paid_total: '0.00',
  remaining: '40.00',
  next_share: null,
  items: [
    {
      id: 1,
      name: 'Margherita',
      category: 'Pizze',
      quantity: 2,
      unit_price: '8.00',
      line_total: '16.00',
      paid_quantity: 1,
    },
    {
      id: 2,
      name: 'Birra',
      category: 'Bevande',
      quantity: 3,
      unit_price: '8.00',
      line_total: '24.00',
      paid_quantity: 0,
    },
  ],
  payments: [],
  ...over,
})

const view = (s: PublicSession | null): PublicTable => ({
  restaurant_name: 'Trattoria del Borgo',
  table_number: 5,
  session: s,
})

function renderAt(path = '/table/5?token=tok') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/table/:tableId" element={<CustomerApp />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function enterAs(user: ReturnType<typeof userEvent.setup>, first = 'Anna', last = 'Russo') {
  await user.type(await screen.findByLabelText('Nome'), first)
  await user.type(screen.getByLabelText('Cognome'), last)
  await user.click(screen.getByRole('button', { name: /Entra al tavolo/ }))
}

beforeEach(() => {
  localStorage.clear()
  Object.values(mocks).forEach((m) => m.mockReset())
})

describe('accesso al tavolo', () => {
  it('senza token chiede di scansionare di nuovo il QR', async () => {
    renderAt('/table/5')
    expect(await screen.findByText('QR non valido')).toBeInTheDocument()
    expect(mocks.view).not.toHaveBeenCalled()
  })

  it('con token sbagliato dice che il tavolo non è stato trovato', async () => {
    mocks.view.mockRejectedValue(new ApiError(404, 'Tavolo non trovato'))
    renderAt()
    expect(await screen.findByText('Tavolo non trovato')).toBeInTheDocument()
  })

  it('senza sessione aperta invita a chiamare il cameriere', async () => {
    mocks.view.mockResolvedValue(view(null))
    renderAt()
    expect(await screen.findByText('Tavolo libero')).toBeInTheDocument()
  })

  it('un errore di rete lo segnala senza perdere la pagina', async () => {
    mocks.view.mockRejectedValue(new ApiError(0, 'Connessione assente: riprova tra poco'))
    renderAt()
    expect(await screen.findByText('Connessione assente: riprova tra poco')).toBeInTheDocument()
  })

  it('il token del QR viene passato all’API e ricordato', async () => {
    mocks.view.mockResolvedValue(view(null))
    renderAt()
    await screen.findByText('Tavolo libero')
    expect(mocks.view).toHaveBeenCalledWith(5, 'tok', expect.anything())
    expect(localStorage.length).toBeGreaterThan(0)
  })
})

describe('primo cliente', () => {
  it('inserisce il nome, sceglie la modalità e vede la sua quota', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(session()))
    mocks.setMode.mockResolvedValue(
      view(session({ payment_mode: 'ROMANA', next_share: '10.00' })),
    )
    renderAt()

    expect(await screen.findByText(/Benvenuto/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Entra al tavolo/ })).toBeDisabled()
    await enterAs(user)

    expect(await screen.findByText('Come dividiamo?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Alla romana/ }))
    expect(mocks.setMode).toHaveBeenCalledWith(5, 'tok', 'ROMANA')

    expect(await screen.findByText('La tua quota')).toBeInTheDocument()
    expect(screen.getByText(/10,00/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Paga la tua quota/ })).toBeEnabled()
  })

  it('se la modalità è già scelta salta la scelta', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(session({ payment_mode: 'ROMANA', next_share: '10.00' })))
    renderAt()
    await enterAs(user)
    expect(await screen.findByText('La tua quota')).toBeInTheDocument()
    expect(screen.queryByText('Come dividiamo?')).not.toBeInTheDocument()
  })

  it('ricorda il nome al ricaricamento', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(session({ payment_mode: 'ROMANA', next_share: '10.00' })))
    const first = renderAt()
    await enterAs(user)
    await screen.findByText('La tua quota')
    first.unmount()

    renderAt()
    expect(await screen.findByText('La tua quota')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
  })
})

describe('pagamento alla romana', () => {
  const romana = () => session({ payment_mode: 'ROMANA', next_share: '10.00' })

  it('alla cassa: invia il nome completo e mostra la conferma', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(romana()))
    mocks.pay.mockResolvedValue({ id: 1, amount: '10.00', method: 'CASH', status: 'CASH' })
    renderAt()
    await enterAs(user)

    await user.click(await screen.findByRole('button', { name: /Paga la tua quota/ }))
    expect(await screen.findByText('Come paghi?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Pago alla cassa/ }))

    expect(mocks.pay).toHaveBeenCalledWith(5, 'tok', {
      method: 'CASH',
      customer_nickname: 'Anna Russo',
    })
    expect(await screen.findByText('Pagherai alla cassa')).toBeInTheDocument()
  })

  it('online: nessun campo carta, avviso di pagamento simulato', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(romana()))
    mocks.pay.mockResolvedValue({ id: 1, amount: '10.00', method: 'ONLINE', status: 'COMPLETED' })
    renderAt()
    await enterAs(user)

    await user.click(await screen.findByRole('button', { name: /Paga la tua quota/ }))
    expect(screen.getByText(/Pagamento simulato/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Paga online/ }))

    expect(mocks.pay).toHaveBeenCalledWith(5, 'tok', {
      method: 'ONLINE',
      customer_nickname: 'Anna Russo',
    })
    expect(screen.queryByLabelText(/Numero carta/)).not.toBeInTheDocument()
    expect(await screen.findByText('Quota saldata online')).toBeInTheDocument()
  })

  it('senza ordini non si può ancora pagare', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(
      view(session({ payment_mode: 'ROMANA', next_share: null, total: '0.00', items: [] })),
    )
    renderAt()
    await enterAs(user)
    expect(await screen.findByText(/Ancora nessun ordine/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Paga la tua quota/ })).not.toBeInTheDocument()
  })

  it('un errore del pagamento viene mostrato e si può riprovare', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(romana()))
    mocks.pay.mockRejectedValue(new ApiError(409, 'Tutte le quote sono già state pagate'))
    renderAt()
    await enterAs(user)

    await user.click(await screen.findByRole('button', { name: /Paga la tua quota/ }))
    await user.click(screen.getByRole('button', { name: /Pago alla cassa/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Tutte le quote sono già state pagate')
    expect(screen.getByRole('button', { name: /Pago alla cassa/ })).toBeEnabled()
  })
})

describe('pagamento del proprio conto', () => {
  const own = () => session({ payment_mode: 'OWN' })

  it('mostra solo le quantità ancora libere e calcola il totale', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(own()))
    renderAt()
    await enterAs(user)

    await user.click(await screen.findByRole('button', { name: /Scegli i tuoi piatti/ }))
    // Margherita: 2 ordinate, 1 già pagata da altri → ne resta 1.
    expect(screen.getByText(/1 disp\./)).toBeInTheDocument()
    expect(screen.getByText(/3 disp\./)).toBeInTheDocument()

    const continua = screen.getByRole('button', { name: /Continua/ })
    expect(continua).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Aggiungi Margherita' }))
    await user.click(screen.getByRole('button', { name: 'Aggiungi Birra' }))
    await user.click(screen.getByRole('button', { name: 'Aggiungi Birra' }))
    expect(screen.getByText(/24,00/)).toBeInTheDocument() // 3 × 8,00
    expect(continua).toBeEnabled()
  })

  it('invia le voci scelte con le quantità', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(own()))
    mocks.pay.mockResolvedValue({ id: 1, amount: '16.00', method: 'CASH', status: 'CASH' })
    renderAt()
    await enterAs(user)

    await user.click(await screen.findByRole('button', { name: /Scegli i tuoi piatti/ }))
    await user.click(screen.getByRole('button', { name: 'Aggiungi Margherita' }))
    await user.click(screen.getByRole('button', { name: 'Aggiungi Birra' }))
    await user.click(screen.getByRole('button', { name: /Continua/ }))
    await user.click(await screen.findByRole('button', { name: /Pago alla cassa/ }))

    expect(mocks.pay).toHaveBeenCalledWith(5, 'tok', {
      method: 'CASH',
      customer_nickname: 'Anna Russo',
      items: [
        { order_item_id: 1, quantity: 1 },
        { order_item_id: 2, quantity: 1 },
      ],
    })
  })
})

describe('tavolo saldato', () => {
  it('dopo il mio pagamento, se la sessione si chiude, mostra il saluto finale', async () => {
    const user = userEvent.setup()
    const aperta = view(session({ payment_mode: 'ROMANA', next_share: '10.00' }))
    mocks.view.mockResolvedValue(aperta)
    mocks.pay.mockResolvedValue({ id: 1, amount: '10.00', method: 'ONLINE', status: 'COMPLETED' })
    renderAt()
    await enterAs(user)
    await user.click(await screen.findByRole('button', { name: /Paga la tua quota/ }))

    // Dal pagamento in poi il server risponde che non c'è più una sessione aperta (conto chiuso).
    mocks.view.mockResolvedValue(view(null))
    await user.click(screen.getByRole('button', { name: /Paga online/ }))

    await waitFor(() => expect(screen.getByText('Tavolo saldato')).toBeInTheDocument())
    expect(screen.getByText(/Online/)).toBeInTheDocument()
  })
})
