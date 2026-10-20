import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeJwt } from '../staff/testing'
import { AccountProvider } from './AccountProvider'
import { RequireCustomer } from './RequireCustomer'

function Posizione() {
  const { pathname, search } = useLocation()
  return <p>home: {pathname + search}</p>
}

function renderAt(path: string) {
  return render(
    <AccountProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<Posizione />} />
          <Route
            path="/customer/history"
            element={
              <RequireCustomer>
                <p>Storico riservato</p>
              </RequireCustomer>
            }
          />
        </Routes>
      </MemoryRouter>
    </AccountProvider>,
  )
}

afterEach(() => localStorage.clear())

describe('RequireCustomer', () => {
  it('senza login porta alla home di accesso, ricordando dove tornare', () => {
    renderAt('/customer/history?pagina=2')
    expect(screen.queryByText('Storico riservato')).not.toBeInTheDocument()
    expect(
      screen.getByText('home: /?redirect=%2Fcustomer%2Fhistory%3Fpagina%3D2'),
    ).toBeInTheDocument()
  })

  it('con il login mostra la pagina', () => {
    localStorage.setItem(
      'cg:account',
      JSON.stringify({
        token: fakeJwt(3600),
        customer: { id: 1, email: 'a@example.com', first_name: 'A', last_name: 'B', city: null },
      }),
    )
    renderAt('/customer/history')
    expect(screen.getByText('Storico riservato')).toBeInTheDocument()
  })
})
