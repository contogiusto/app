import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Customer, CustomerPayment } from '../api/client'
import App from '../App'
import { fakeJwt } from '../staff/testing'

/** Aiuti per i test delle schermate dell'account (si usa l'App vera, con le sue rotte). */

export const ANNA: Customer = {
  id: 1,
  email: 'anna@example.com',
  first_name: 'Anna',
  last_name: 'Russo',
  city: 'Milano',
}

export const auth = (customer: Customer = ANNA) => ({
  access_token: fakeJwt(3600),
  token_type: 'bearer' as const,
  customer,
})

/** Simula un cliente già collegato (come dopo un login precedente). */
export function loginAsAnna() {
  localStorage.setItem('cg:account', JSON.stringify({ token: fakeJwt(3600), customer: ANNA }))
}

export const payment = (over: Partial<CustomerPayment> = {}): CustomerPayment => ({
  id: 1,
  amount: '12.50',
  created_at: '2026-03-14T19:30:00Z',
  session_opened_at: '2026-03-14T19:00:00Z',
  restaurant_name: 'Trattoria Rossi',
  table_number: 7,
  method: 'ONLINE',
  mode: 'OWN',
  status: 'COMPLETED',
  items: [{ name: 'Carbonara', category: 'Primi', quantity: 1, unit_price: '12.50' }],
  ...over,
})

export function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
