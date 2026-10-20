import { act, render, renderHook } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, type Customer, type CustomerAuth } from '../api/client'
import { fakeJwt } from '../staff/testing'
import { ACCOUNT_EXPIRED_NOTICE, useAccount } from './account'
import { AccountProvider } from './AccountProvider'
import { loadAccountSession } from './session'

const wrapper = ({ children }: { children: ReactNode }) => (
  <AccountProvider>{children}</AccountProvider>
)

const customer: Customer = {
  id: 1,
  email: 'anna@example.com',
  first_name: 'Anna',
  last_name: 'Russo',
  city: 'Milano',
}
const auth = (expiresInSeconds = 3600): CustomerAuth => ({
  access_token: fakeJwt(expiresInSeconds),
  token_type: 'bearer',
  customer,
})

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('AccountProvider', () => {
  it('parte senza nessuno collegato', () => {
    const { result } = renderHook(() => useAccount(), { wrapper })
    expect(result.current.session).toBeNull()
  })

  it('login: ricorda il cliente e toglie spazi dall’email', async () => {
    const login = vi.spyOn(api.customer, 'login').mockResolvedValue(auth())
    const { result } = renderHook(() => useAccount(), { wrapper })
    await act(() => result.current.login('  anna@example.com ', 'una-password-buona'))
    expect(login).toHaveBeenCalledWith('anna@example.com', 'una-password-buona')
    expect(result.current.session?.customer.first_name).toBe('Anna')
    expect(loadAccountSession()?.customer.email).toBe('anna@example.com')
  })

  it('un login fallito non collega nessuno e lascia l’errore dell’API', async () => {
    vi.spyOn(api.customer, 'login').mockRejectedValue(new ApiError(401, 'Credenziali non valide'))
    const { result } = renderHook(() => useAccount(), { wrapper })
    await expect(act(() => result.current.login('a@example.com', 'x'))).rejects.toMatchObject({
      message: 'Credenziali non valide',
    })
    expect(result.current.session).toBeNull()
    expect(loadAccountSession()).toBeNull()
  })

  it('registrazione: collega subito il nuovo cliente', async () => {
    const register = vi.spyOn(api.customer, 'register').mockResolvedValue(auth())
    const { result } = renderHook(() => useAccount(), { wrapper })
    await act(() =>
      result.current.register({
        email: ' anna@example.com',
        password: 'una-password-buona',
        first_name: 'Anna',
        last_name: 'Russo',
        accept_privacy: true,
      }),
    )
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ email: 'anna@example.com' }))
    expect(result.current.session?.customer.id).toBe(1)
  })

  it('esci azzera sessione e memoria, con un messaggio facoltativo', async () => {
    vi.spyOn(api.customer, 'login').mockResolvedValue(auth())
    const { result } = renderHook(() => useAccount(), { wrapper })
    await act(() => result.current.login('anna@example.com', 'x'))
    act(() => result.current.logout('Ciao'))
    expect(result.current.session).toBeNull()
    expect(result.current.notice).toBe('Ciao')
    expect(loadAccountSession()).toBeNull()
  })

  it('setCustomer aggiorna i dati mostrati e quelli ricordati', async () => {
    vi.spyOn(api.customer, 'login').mockResolvedValue(auth())
    const { result } = renderHook(() => useAccount(), { wrapper })
    await act(() => result.current.login('anna@example.com', 'x'))
    act(() => result.current.setCustomer({ ...customer, city: 'Torino' }))
    expect(result.current.session?.customer.city).toBe('Torino')
    expect(loadAccountSession()?.customer.city).toBe('Torino')
  })

  it('riprende il login salvato al ricaricamento, ma non se il token è scaduto', () => {
    localStorage.setItem('cg:account', JSON.stringify({ token: fakeJwt(3600), customer }))
    const valido = renderHook(() => useAccount(), { wrapper })
    expect(valido.result.current.session?.customer.email).toBe('anna@example.com')
    valido.unmount()

    localStorage.setItem('cg:account', JSON.stringify({ token: fakeJwt(-5), customer }))
    const scaduto = renderHook(() => useAccount(), { wrapper })
    expect(scaduto.result.current.session).toBeNull()
  })

  it('allo scadere del token si esce da soli, con un messaggio', () => {
    vi.useFakeTimers()
    localStorage.setItem('cg:account', JSON.stringify({ token: fakeJwt(60), customer }))
    const { result } = renderHook(() => useAccount(), { wrapper })
    expect(result.current.session).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(61_000)
    })
    expect(result.current.session).toBeNull()
    expect(result.current.notice).toBe(ACCOUNT_EXPIRED_NOTICE)
  })

  it('una risposta 401 dell’API fa uscire il cliente', async () => {
    localStorage.setItem('cg:account', JSON.stringify({ token: fakeJwt(3600), customer }))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'Autenticazione richiesta' }), { status: 401 }),
      ),
    )
    const { result } = renderHook(() => useAccount(), { wrapper })
    await act(async () => {
      await api.customer.me().catch(() => undefined)
    })
    expect(result.current.session).toBeNull()
    expect(result.current.notice).toBe(ACCOUNT_EXPIRED_NOTICE)
  })

  it('una schermata che chiede dati appena montata (ricarico) trova già il token', () => {
    const token = fakeJwt(3600)
    localStorage.setItem('cg:account', JSON.stringify({ token, customer }))
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)
    function Schermata() {
      useEffect(() => {
        void api.customer.payments().catch(() => undefined)
      }, [])
      return null
    }
    render(
      <AccountProvider>
        <Schermata />
      </AccountProvider>,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: `Bearer ${token}`,
    })
  })
})

describe('pagamento al tavolo e account', () => {
  const pay = () => api.table.pay(5, 'token-qr', { method: 'CASH', customer_nickname: 'Anna' })
  const headersOf = (fetchMock: ReturnType<typeof vi.fn>) =>
    (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>

  it('con un cliente collegato manda anche il suo token', async () => {
    const token = fakeJwt(3600)
    localStorage.setItem('cg:account', JSON.stringify({ token, customer }))
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":1}', { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AccountProvider>{null}</AccountProvider>)
    await pay()
    expect(headersOf(fetchMock)).toMatchObject({
      'X-Table-Token': 'token-qr',
      Authorization: `Bearer ${token}`,
    })
  })

  it('da ospite manda solo il token del tavolo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":1}', { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AccountProvider>{null}</AccountProvider>)
    await pay()
    expect(headersOf(fetchMock)['X-Table-Token']).toBe('token-qr')
    expect(headersOf(fetchMock)).not.toHaveProperty('Authorization')
  })

  it('con un token scaduto paga da ospite invece di mandare un token che verrebbe ignorato', async () => {
    localStorage.setItem('cg:account', JSON.stringify({ token: fakeJwt(-5), customer }))
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":1}', { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AccountProvider>{null}</AccountProvider>)
    await pay()
    expect(headersOf(fetchMock)).not.toHaveProperty('Authorization')
  })
})
