import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from './client'

const fetchMock = vi.fn()

beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, init, headers: init.headers as Record<string, string> }
}

describe('api', () => {
  it('login invia le credenziali in JSON e restituisce il token', async () => {
    fetchMock.mockResolvedValue(json(200, { access_token: 't', token_type: 'bearer', role: 'ADMIN' }))
    const result = await api.login('admin', 'segreta')
    expect(result.role).toBe('ADMIN')
    const { url, init, headers } = lastCall()
    expect(url).toBe('/api/auth/login')
    expect(init.method).toBe('POST')
    expect(headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({ username: 'admin', password: 'segreta' })
  })

  it('me manda il token come Bearer', async () => {
    fetchMock.mockResolvedValue(json(200, { id: 1, username: 'admin', role: 'ADMIN' }))
    await api.me('abc')
    expect(lastCall().headers.Authorization).toBe('Bearer abc')
  })

  it('il tavolo usa l’header X-Table-Token e non mette il token nell’URL', async () => {
    fetchMock.mockResolvedValue(json(200, { table_number: 5, session: null }))
    await api.table.view(5, 'segreto-qr')
    const { url, headers } = lastCall()
    expect(url).toBe('/api/public/tables/5')
    expect(url).not.toContain('segreto-qr')
    expect(headers['X-Table-Token']).toBe('segreto-qr')
  })

  it('setMode e pay usano PUT e POST sul tavolo', async () => {
    fetchMock.mockResolvedValue(json(200, { table_number: 5, session: null }))
    await api.table.setMode(5, 'tok', 'ROMANA')
    expect(lastCall().url).toBe('/api/public/tables/5/mode')
    expect(lastCall().init.method).toBe('PUT')
    expect(JSON.parse(lastCall().init.body as string)).toEqual({ payment_mode: 'ROMANA' })

    fetchMock.mockResolvedValue(json(201, { id: 1 }))
    await api.table.pay(5, 'tok', { method: 'ONLINE', customer_nickname: 'Anna' })
    expect(lastCall().url).toBe('/api/public/tables/5/payments')
    expect(lastCall().init.method).toBe('POST')
  })

  it('un 204 senza corpo non dà errore', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(api.menu()).resolves.toBeUndefined()
  })
})

describe('errori', () => {
  it('usa il messaggio `detail` dell’API', async () => {
    fetchMock.mockResolvedValue(json(409, { detail: 'La sessione è chiusa' }))
    await expect(api.menu()).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      message: 'La sessione è chiusa',
    })
  })

  it('un errore di validazione diventa un messaggio leggibile', async () => {
    fetchMock.mockResolvedValue(json(422, { detail: [{ loc: ['body', 'quantity'], msg: 'x' }] }))
    await expect(api.menu()).rejects.toMatchObject({ status: 422, message: 'Dati non validi' })
  })

  it('un errore del server senza JSON ha un messaggio generico', async () => {
    fetchMock.mockResolvedValue(new Response('Internal Server Error', { status: 500 }))
    await expect(api.menu()).rejects.toMatchObject({
      status: 500,
      message: 'Errore del server (500)',
    })
  })

  it('senza rete risponde con ApiError di status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await api.menu().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0, message: 'Connessione assente: riprova tra poco' })
  })

  it('una richiesta annullata non si trasforma in errore di rete', async () => {
    fetchMock.mockRejectedValue(new DOMException('annullata', 'AbortError'))
    await expect(api.menu()).rejects.toMatchObject({ name: 'AbortError' })
  })
})
