import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App', () => {
  it('la home mostra il nome del prodotto', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Conto Giusto' })).toBeInTheDocument()
  })

  it('la pagina del tavolo senza token chiede di scansionare il QR', () => {
    renderAt('/table/3')
    expect(screen.getByRole('heading', { name: 'QR non valido' })).toBeInTheDocument()
  })

  it('un indirizzo sconosciuto mostra "Pagina non trovata"', () => {
    renderAt('/non-esiste')
    expect(screen.getByRole('heading', { name: 'Pagina non trovata' })).toBeInTheDocument()
  })
})
