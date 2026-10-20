import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '../api/client'
import { loginAsAnna, payment, renderApp } from './testing'

vi.mock('../scanner/ScanPage', () => ({ default: () => <h1>Scanner (finto)</h1> }))

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('guardia dell’area cliente', () => {
  it('senza login rimanda alla home con il ritorno alla pagina chiesta', async () => {
    renderApp('/customer/history')
    expect(await screen.findByRole('tab', { name: 'Accedi' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Storico' })).not.toBeInTheDocument()
  })

  it('con il login mostra la pagina, con nome e navigazione', async () => {
    loginAsAnna()
    vi.spyOn(api.customer, 'payments').mockResolvedValue([])
    renderApp('/customer/history')
    expect(await screen.findByRole('heading', { name: 'Storico' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Principale' })
    for (const name of ['Home', 'Storico', 'Profilo', 'Scansiona QR']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
    }
    expect(within(nav).getByRole('link', { name: 'Scansiona QR' })).toHaveAttribute(
      'href',
      '/customer/scan',
    )
  })

  it('Esci riporta alla home di accesso', async () => {
    const user = userEvent.setup()
    loginAsAnna()
    vi.spyOn(api.customer, 'payments').mockResolvedValue([])
    renderApp('/customer/history')
    await user.click(await screen.findByRole('button', { name: 'Esci' }))
    expect(await screen.findByRole('tab', { name: 'Accedi' })).toBeInTheDocument()
    expect(localStorage.getItem('cg:account')).toBeNull()
  })
})

describe('home dell’area cliente', () => {
  it('saluta, offre lo scanner e mostra solo gli ultimi 3 pagamenti', async () => {
    loginAsAnna()
    vi.spyOn(api.customer, 'payments').mockResolvedValue(
      [1, 2, 3, 4].map((id) => payment({ id, restaurant_name: `Locale ${id}` })),
    )
    renderApp('/customer/home')
    expect(await screen.findByRole('heading', { name: /Ciao, Anna/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Scansiona il QR del tavolo/ })).toHaveAttribute(
      'href',
      '/customer/scan',
    )
    expect(await screen.findByText('Locale 3')).toBeInTheDocument()
    expect(screen.queryByText('Locale 4')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vedi tutto' })).toHaveAttribute(
      'href',
      '/customer/history',
    )
  })

  it('senza pagamenti invita a scansionare un QR', async () => {
    loginAsAnna()
    vi.spyOn(api.customer, 'payments').mockResolvedValue([])
    renderApp('/customer/home')
    expect(await screen.findByText(/Non hai ancora pagamenti/)).toBeInTheDocument()
  })
})

describe('storico', () => {
  it('mostra il caricamento, poi i pagamenti con importo, tavolo, metodo e stato', async () => {
    loginAsAnna()
    vi.spyOn(api.customer, 'payments').mockResolvedValue([
      payment({ id: 1 }),
      payment({
        id: 2,
        restaurant_name: 'Osteria Verdi',
        amount: '8.00',
        method: 'CASH',
        status: 'CASH',
        table_number: 3,
      }),
    ])
    renderApp('/customer/history')
    expect(screen.getByRole('status')).toHaveTextContent('Caricamento')
    expect(await screen.findByText('Trattoria Rossi')).toBeInTheDocument()
    expect(screen.getByText(/Tavolo 7 · Online/)).toBeInTheDocument()
    expect(screen.getByText('Pagato')).toBeInTheDocument()
    expect(screen.getByText(/Alla cassa, in attesa di conferma/)).toBeInTheDocument()
    expect(screen.getByText(/Tavolo 3 · Contanti/)).toBeInTheDocument()
    expect(screen.getByText(/8,00/)).toBeInTheDocument()
  })

  it('OWN: i piatti sono "Piatti pagati"', async () => {
    loginAsAnna()
    vi.spyOn(api.customer, 'payments').mockResolvedValue([payment({ mode: 'OWN' })])
    renderApp('/customer/history')
    expect(await screen.findByText('Piatti pagati')).toBeInTheDocument()
    expect(screen.getByText('1× Carbonara')).toBeInTheDocument()
    expect(screen.queryByText(/Piatti del tavolo/)).not.toBeInTheDocument()
  })

  it('ROMANA: i piatti sono quelli del tavolo e l’importo è una quota', async () => {
    loginAsAnna()
    vi.spyOn(api.customer, 'payments').mockResolvedValue([
      payment({
        mode: 'ROMANA',
        amount: '10.00',
        items: [
          { name: 'Carbonara', category: 'Primi', quantity: 1, unit_price: '12.50' },
          { name: 'Tiramisù', category: 'Dolci', quantity: 3, unit_price: '5.00' },
        ],
      }),
    ])
    renderApp('/customer/history')
    expect(await screen.findByText(/Piatti del tavolo/)).toBeInTheDocument()
    expect(screen.queryByText('Piatti pagati')).not.toBeInTheDocument()
    expect(screen.getByText('3× Tiramisù')).toBeInTheDocument()
    expect(screen.getByText(/una parte del totale del tavolo/)).toBeInTheDocument()
  })

  it('vuoto: invita a scansionare un QR', async () => {
    loginAsAnna()
    vi.spyOn(api.customer, 'payments').mockResolvedValue([])
    renderApp('/customer/history')
    expect(await screen.findByText(/Nessun pagamento/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Scansiona il QR/ })).toHaveAttribute(
      'href',
      '/customer/scan',
    )
  })

  it('errore: messaggio e "Riprova" che richiede i dati', async () => {
    const user = userEvent.setup()
    loginAsAnna()
    const payments = vi
      .spyOn(api.customer, 'payments')
      .mockRejectedValueOnce(new ApiError(500, 'Errore del server'))
      .mockResolvedValue([payment()])
    renderApp('/customer/history')
    expect(await screen.findByRole('alert')).toHaveTextContent('Errore del server')
    await user.click(screen.getByRole('button', { name: 'Riprova' }))
    expect(await screen.findByText('Trattoria Rossi')).toBeInTheDocument()
    expect(payments).toHaveBeenCalledTimes(2)
  })
})
