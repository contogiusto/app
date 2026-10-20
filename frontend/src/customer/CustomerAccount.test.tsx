import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountProvider } from '../account/AccountProvider'
import { safeRedirect } from '../account/redirect'
import { ApiError, type PublicSession, type PublicTable } from '../api/client'
import { fakeJwt } from '../staff/testing'
import { CustomerApp } from './CustomerApp'

// Scelta iniziale (accedi / registrati / ospite), cliente collegato e inviti dopo il pagamento.

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
      paid_quantity: 0,
    },
  ],
  payments: [],
  ...over,
})

const romana = () => session({ payment_mode: 'ROMANA', next_share: '10.00' })

const view = (s: PublicSession | null): PublicTable => ({
  restaurant_name: 'Trattoria del Borgo',
  table_number: 5,
  session: s,
})

const paidOnline = { id: 1, amount: '10.00', method: 'ONLINE', status: 'COMPLETED' } as const

/** Mostra dove porta il link di accesso (la home vera la costruisce un'altra parte dell'app). */
function Home() {
  const { pathname, search } = useLocation()
  return <p data-testid="home">{pathname + search}</p>
}

/** Parametri del link di accesso verso cui il test è stato portato. */
const homeParams = () =>
  new URLSearchParams((screen.getByTestId('home').textContent as string).split('?')[1])

function logIn(first = 'Marta', last = 'Bianchi') {
  localStorage.setItem(
    'cg:account',
    JSON.stringify({
      token: fakeJwt(3600),
      customer: { id: 1, email: 'm@example.com', first_name: first, last_name: last },
    }),
  )
}

function renderAt(path = '/table/5?token=tok') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AccountProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/customer/history" element={<p>Pagina storico</p>} />
            <Route path="/table/:tableId" element={<CustomerApp />} />
          </Routes>
        </MemoryRouter>
      </AccountProvider>
    </QueryClientProvider>,
  )
}

type User = ReturnType<typeof userEvent.setup>

const asGuest = async (user: User) =>
  user.click(await screen.findByRole('button', { name: 'Continua come ospite' }))

async function enterAs(user: User) {
  await asGuest(user)
  await user.type(await screen.findByLabelText('Nome'), 'Anna')
  await user.type(screen.getByLabelText('Cognome'), 'Russo')
  await user.click(screen.getByRole('button', { name: /Entra al tavolo/ }))
}

beforeEach(() => {
  localStorage.clear()
  Object.values(mocks).forEach((m) => m.mockReset())
})

describe('scelta iniziale', () => {
  it('offre accedi, registrati e continua come ospite, con la spiegazione', async () => {
    mocks.view.mockResolvedValue(view(session()))
    renderAt()
    expect(await screen.findByText('Come vuoi entrare?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Accedi/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrati' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continua come ospite' })).toBeInTheDocument()
    expect(screen.getByText(/anche da ospite/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
  })

  it('"Continua come ospite" porta alla schermata del nome', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(session()))
    renderAt()
    await asGuest(user)
    expect(await screen.findByLabelText('Nome')).toBeInTheDocument()
  })

  it('la scelta ospite si ricorda per la sessione, non per quella dopo', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(session()))
    const first = renderAt()
    await asGuest(user)
    await screen.findByLabelText('Nome')
    first.unmount()

    const again = renderAt()
    expect(await screen.findByLabelText('Nome')).toBeInTheDocument()
    expect(screen.queryByText('Come vuoi entrare?')).not.toBeInTheDocument()
    again.unmount()

    // Il tavolo viene riaperto con una nuova sessione (id diverso): si riparte dalla scelta.
    mocks.view.mockResolvedValue(view(session({ id: 8 })))
    renderAt()
    expect(await screen.findByText('Come vuoi entrare?')).toBeInTheDocument()
  })

  it('Accedi porta al login e il ritorno riporta al tavolo con il token', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(session()))
    renderAt('/table/5?token=tok%26x')
    await user.click(await screen.findByRole('button', { name: /Accedi/ }))

    expect((screen.getByTestId('home').textContent as string).startsWith('/?')).toBe(true)
    expect(homeParams().get('mode')).toBeNull()
    // Dopo il login la home legge ?redirect= con safeRedirect: il percorso del tavolo è integro.
    expect(safeRedirect(homeParams().get('redirect'))).toBe('/table/5?token=tok%26x')
  })

  it('Registrati apre la registrazione con lo stesso ritorno', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(session()))
    renderAt()
    await user.click(await screen.findByRole('button', { name: 'Registrati' }))
    expect(homeParams().get('mode')).toBe('register')
    expect(safeRedirect(homeParams().get('redirect'))).toBe('/table/5?token=tok')
  })

  it('il ritorno ha il token anche se l’URL attuale non lo ha (era ricordato)', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(session()))
    renderAt() // memorizza il token
    await screen.findByText('Come vuoi entrare?')
    cleanup()

    renderAt('/table/5')
    await user.click(await screen.findByRole('button', { name: /Accedi/ }))
    expect(homeParams().get('redirect')).toBe('/table/5?token=tok')
  })

  it('non compare con il tavolo libero né con un QR non valido', async () => {
    mocks.view.mockResolvedValue(view(null))
    const libero = renderAt()
    expect(await screen.findByText('Tavolo libero')).toBeInTheDocument()
    expect(screen.queryByText('Come vuoi entrare?')).not.toBeInTheDocument()
    libero.unmount()

    const senzaToken = renderAt('/table/9')
    expect(await screen.findByText('QR non valido')).toBeInTheDocument()
    expect(screen.queryByText('Come vuoi entrare?')).not.toBeInTheDocument()
    senzaToken.unmount()

    mocks.view.mockRejectedValue(new ApiError(404, 'Tavolo non trovato'))
    renderAt()
    expect(await screen.findByText('Tavolo non trovato')).toBeInTheDocument()
    expect(screen.queryByText('Come vuoi entrare?')).not.toBeInTheDocument()
  })

  it('chi ha già inserito il nome non la rivede', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(romana()))
    const first = renderAt()
    await enterAs(user)
    await screen.findByText('La tua quota')
    first.unmount()
    renderAt()
    expect(await screen.findByText('La tua quota')).toBeInTheDocument()
    expect(screen.queryByText('Come vuoi entrare?')).not.toBeInTheDocument()
  })
})

describe('cliente collegato', () => {
  it('salta scelta e nome, e va alla modalità', async () => {
    logIn()
    mocks.view.mockResolvedValue(view(session()))
    renderAt()
    expect(await screen.findByText('Come dividiamo?')).toBeInTheDocument()
    expect(screen.queryByText('Come vuoi entrare?')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
  })

  it('paga con il nome dell’account e lo ricorda come identità della sessione', async () => {
    const user = userEvent.setup()
    logIn('Marta', 'Bianchi')
    mocks.view.mockResolvedValue(view(romana()))
    mocks.pay.mockResolvedValue(paidOnline)
    renderAt()

    await user.click(await screen.findByRole('button', { name: /Paga la tua quota/ }))
    await user.click(screen.getByRole('button', { name: /Paga online/ }))
    expect(mocks.pay).toHaveBeenCalledWith(5, 'tok', {
      method: 'ONLINE',
      customer_nickname: 'Marta Bianchi',
    })
    expect(JSON.parse(localStorage.getItem('cg:5:identity') as string)).toEqual({
      sessionId: 7,
      name: 'Marta Bianchi',
      account: true,
    })
  })

  it('mostra "Stai pagando come" e dopo il pagamento il link allo storico', async () => {
    const user = userEvent.setup()
    logIn()
    mocks.view.mockResolvedValue(view(romana()))
    mocks.pay.mockResolvedValue(paidOnline)
    renderAt()
    expect(await screen.findByText(/Stai pagando come/)).toHaveTextContent('Marta Bianchi')
    expect(screen.queryByText(/Crea un account/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Paga la tua quota/ }))
    await user.click(screen.getByRole('button', { name: /Paga online/ }))
    expect(await screen.findByText(/Il pagamento è nel tuo storico/)).toBeInTheDocument()
    expect(screen.queryByText(/Crea un account/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Vai allo storico' }))
    expect(await screen.findByText('Pagina storico')).toBeInTheDocument()
  })

  it('"Non sei tu? Esci" esce dall’account e torna alla scelta, senza perdere il tavolo', async () => {
    const user = userEvent.setup()
    logIn()
    mocks.view.mockResolvedValue(view(romana()))
    renderAt()
    await user.click(await screen.findByRole('button', { name: 'Non sei tu? Esci' }))

    expect(await screen.findByText('Come vuoi entrare?')).toBeInTheDocument()
    expect(localStorage.getItem('cg:account')).toBeNull()
    expect(localStorage.getItem('cg:5:identity')).toBeNull()
    expect(localStorage.getItem('cg:5:token')).toBe(JSON.stringify('tok'))
  })

  it('un account scaduto non vale: si torna alla scelta', async () => {
    localStorage.setItem(
      'cg:account',
      JSON.stringify({
        token: fakeJwt(-10),
        customer: { id: 1, email: 'm@example.com', first_name: 'Marta', last_name: 'Bianchi' },
      }),
    )
    mocks.view.mockResolvedValue(view(romana()))
    renderAt()
    expect(await screen.findByText('Come vuoi entrare?')).toBeInTheDocument()
  })
})

describe('inviti dopo il pagamento da ospite', () => {
  it('nell’hub invita a creare un account, solo dopo aver pagato', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(romana()))
    mocks.pay.mockResolvedValue(paidOnline)
    renderAt()
    await enterAs(user)
    await user.click(await screen.findByRole('button', { name: /Paga la tua quota/ }))
    expect(screen.queryByText(/Crea un account/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Paga online/ }))

    const link = await screen.findByRole('link', { name: 'Crea un account' })
    expect(link).toHaveAttribute('href', '/?redirect=%2Fcustomer%2Fhome&mode=register')
    expect(screen.queryByText(/nel tuo storico/)).not.toBeInTheDocument()
  })

  it('nel tavolo saldato: invito da ospite, storico da collegato', async () => {
    const user = userEvent.setup()
    mocks.view.mockResolvedValue(view(romana()))
    mocks.pay.mockResolvedValue(paidOnline)
    const guest = renderAt()
    await enterAs(user)
    await user.click(await screen.findByRole('button', { name: /Paga la tua quota/ }))
    mocks.view.mockResolvedValue(view(null))
    await user.click(screen.getByRole('button', { name: /Paga online/ }))
    await screen.findByText('Tavolo saldato')
    expect(screen.getByRole('link', { name: 'Crea un account' })).toBeInTheDocument()
    guest.unmount()

    logIn()
    renderAt() // il pagamento ricordato dal browser mostra ancora il saluto
    await screen.findByText('Tavolo saldato')
    expect(screen.getByText(/Il pagamento è nel tuo storico/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Crea un account' })).not.toBeInTheDocument()
  })
})
