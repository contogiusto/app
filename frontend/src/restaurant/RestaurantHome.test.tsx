import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '../api/client'
import RestaurantHome from './RestaurantHome'

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/ristorante/:slug" element={<RestaurantHome />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.restoreAllMocks())

describe('pagina del ristorante', () => {
  it('mostra il nome e i collegamenti', async () => {
    vi.spyOn(api, 'restaurant').mockResolvedValue({ slug: 'da-gino', name: 'Da Gino' })
    renderAt('/ristorante/da-gino')
    expect(await screen.findByRole('heading', { name: 'Da Gino' })).toBeInTheDocument()
    expect(api.restaurant).toHaveBeenCalledWith('da-gino')
    expect(screen.getByRole('link', { name: /Inquadra il QR/ })).toHaveAttribute('href', '/customer/scan')
    expect(screen.getByRole('link', { name: 'Accesso staff' })).toHaveAttribute(
      'href',
      '/ristorante/da-gino/accesso',
    )
  })

  it('un ristorante inesistente o disattivato dà un messaggio chiaro', async () => {
    vi.spyOn(api, 'restaurant').mockRejectedValue(new ApiError(404, 'Ristorante non trovato'))
    renderAt('/ristorante/nessuno')
    expect(await screen.findByRole('alert')).toHaveTextContent('Ristorante non trovato')
  })
})
