import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App', () => {
  it('la home mostra il nome del prodotto', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Conto Giusto' })).toBeInTheDocument()
  })

  it('la pagina del tavolo legge il numero dall’indirizzo', () => {
    renderAt('/table/3?token=abc')
    expect(screen.getByRole('heading', { name: 'Tavolo 3' })).toBeInTheDocument()
  })

  it('un indirizzo sconosciuto mostra "Pagina non trovata"', () => {
    renderAt('/non-esiste')
    expect(screen.getByRole('heading', { name: 'Pagina non trovata' })).toBeInTheDocument()
  })
})
