import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { fakeJwt } from '../staff/testing'
import { ApiError, api, setStaffAuth } from './client'

// Le schermate vere del cameriere hanno i loro test (src/waiter): qui conta solo la rotta.
vi.mock('../waiter/WaiterApp', async () => {
  const { StaffLayout } = await import('../staff/StaffLayout')
  return { default: () => <StaffLayout title="Sala">{null}</StaffLayout> }
})

const fetchMock = vi.fn()

beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  setStaffAuth(null)
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, init, headers: init.headers as Record<string, string> }
}

describe('api.staff', () => {
  const onUnauthorized = vi.fn()
  beforeEach(() => {
    onUnauthorized.mockReset()
    setStaffAuth({ getToken: () => 'jwt-corrente', onUnauthorized })
  })

  it('manda il token corrente come Bearer', async () => {
    fetchMock.mockResolvedValue(json(200, []))
    await api.staff.tables.list()
    expect(lastCall().url).toBe('/api/tables')
    expect(lastCall().headers.Authorization).toBe('Bearer jwt-corrente')
  })

  it('apre una sessione con tavolo e coperti', async () => {
    fetchMock.mockResolvedValue(json(201, { id: 1 }))
    await api.staff.sessions.open(4, 3)
    expect(lastCall().url).toBe('/api/sessions')
    expect(lastCall().init.method).toBe('POST')
    expect(JSON.parse(lastCall().init.body as string)).toEqual({ table_id: 4, coperti: 3 })
  })

  it('usa i metodi e gli indirizzi giusti per ordini, pagamenti e menu', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(200, {})))
    const cases: [() => Promise<unknown>, string, string][] = [
      [() => api.staff.sessions.setMode(7, 'OWN'), 'PUT', '/api/sessions/7/mode'],
      [() => api.staff.sessions.close(7), 'POST', '/api/sessions/7/close'],
      [() => api.staff.orders.list(7), 'GET', '/api/sessions/7/orders'],
      [() => api.staff.orders.add(7, 2, 3), 'POST', '/api/sessions/7/orders'],
      [() => api.staff.payments.list(7), 'GET', '/api/sessions/7/payments'],
      [() => api.staff.payments.confirmCash(9), 'PUT', '/api/payments/9/confirm'],
      [() => api.staff.menu.all(), 'GET', '/api/menu/all'],
    ]
    for (const [call, method, url] of cases) {
      await call()
      expect(lastCall().url).toBe(url)
      expect(lastCall().init.method ?? 'GET').toBe(method)
    }
  })

  it('rimuovere un ordine o un piatto (204) non dà errore', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(api.staff.orders.remove(7, 3)).resolves.toBeUndefined()
    expect(lastCall().init.method).toBe('DELETE')
    await expect(api.staff.menu.remove(5)).resolves.toBeUndefined()
    expect(lastCall().url).toBe('/api/menu/5')
  })

  it('il QR si scarica come file con il token nell’header', async () => {
    fetchMock.mockResolvedValue(
      new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', {
        headers: { 'Content-Type': 'image/svg+xml' },
      }),
    )
    const blob = await api.staff.tables.qr(4)
    expect(blob).toBeInstanceOf(Blob)
    expect(lastCall().url).toBe('/api/tables/4/qr.svg')
    expect(lastCall().headers.Authorization).toBe('Bearer jwt-corrente')
  })

  it('su 401 esegue il logout e rilancia l’errore', async () => {
    fetchMock.mockResolvedValue(json(401, { detail: 'Token non valido' }))
    await expect(api.staff.tables.list()).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('su 403 o 409 non fa il logout', async () => {
    fetchMock.mockResolvedValue(json(403, { detail: 'Permesso negato' }))
    await expect(api.staff.menu.all()).rejects.toBeInstanceOf(ApiError)
    fetchMock.mockResolvedValue(json(409, { detail: 'Sessione chiusa' }))
    await expect(api.staff.orders.list(1)).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('senza token valido non chiama la rete: logout e errore 401', async () => {
    setStaffAuth({ getToken: () => null, onUnauthorized })
    await expect(api.staff.tables.list()).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('il login sbagliato (401) non è un logout: è l’errore da mostrare', async () => {
    fetchMock.mockResolvedValue(json(401, { detail: 'Credenziali non valide' }))
    await expect(api.login('a', 'b')).rejects.toMatchObject({ message: 'Credenziali non valide' })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('401 dell’API con AuthProvider', () => {
  it('riporta al login con il messaggio di sessione scaduta', async () => {
    localStorage.setItem(
      'cg:staff',
      JSON.stringify({ token: fakeJwt(3600), role: 'WAITER', username: 'anna' }),
    )
    fetchMock.mockResolvedValue(json(401, { detail: 'Token non valido' }))
    render(
      <MemoryRouter initialEntries={['/waiter']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Sala' })).toBeInTheDocument()
    await api.staff.tables.list().catch(() => undefined)
    expect(await screen.findByRole('heading', { name: 'Accedi.' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Sessione scaduta')
    expect(localStorage.getItem('cg:staff')).toBeNull()
  })
})
