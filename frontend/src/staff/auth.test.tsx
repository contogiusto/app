import { act, render, renderHook, screen } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '../api/client'
import { SESSION_EXPIRED_NOTICE, useAuth } from './auth'
import { AuthProvider } from './AuthProvider'
import { loadStaffSession, tokenExpiry } from './session'
import { fakeJwt } from './testing'

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('session', () => {
  it('legge la scadenza dal payload senza verificare la firma', () => {
    const now = Date.now()
    expect(tokenExpiry(fakeJwt(60, now))).toBe(Math.floor(now / 1000) * 1000 + 60_000)
    expect(tokenExpiry('non-un-jwt')).toBeNull()
  })

  it('un token scaduto o illeggibile non viene ripreso dallo storage', () => {
    const save = (token: string) =>
      localStorage.setItem('cg:staff', JSON.stringify({ token, role: 'WAITER', username: 'anna' }))
    save(fakeJwt(-10))
    expect(loadStaffSession()).toBeNull()
    save('spazzatura')
    expect(loadStaffSession()).toBeNull()
    save(fakeJwt(3600))
    expect(loadStaffSession()).toMatchObject({ username: 'anna', role: 'WAITER' })
  })

  it('uno storage con dati malformati non rompe nulla', () => {
    localStorage.setItem('cg:staff', '{non json')
    expect(loadStaffSession()).toBeNull()
  })
})

describe('AuthProvider', () => {
  it('una schermata che chiede dati appena montata (ricarico della pagina) trova già il token', async () => {
    const token = fakeJwt(3600)
    localStorage.setItem('cg:staff', JSON.stringify({ token, role: 'WAITER', username: 'anna' }))
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)
    function Screen() {
      // Come useQuery: la richiesta parte in un effetto del figlio, che gira prima di quelli del padre.
      useEffect(() => {
        void api.staff.tables.list().catch(() => undefined)
      }, [])
      return null
    }
    render(
      <AuthProvider>
        <Screen />
      </AuthProvider>,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${token}` })
    vi.unstubAllGlobals()
  })

  it('il login salva token, ruolo e utente (anche nello storage)', async () => {
    const token = fakeJwt(3600)
    vi.spyOn(api, 'login').mockResolvedValue({
      access_token: token,
      token_type: 'bearer',
      role: 'ADMIN',
      must_change_password: false,
    })
    const { result } = renderHook(useAuth, { wrapper })
    expect(result.current.session).toBeNull()

    await act(() => result.current.login('  mario ', 'segreta'))

    expect(api.login).toHaveBeenCalledWith('mario', 'segreta')
    const expected = { token, role: 'ADMIN', username: 'mario', restaurant: null, mustChangePassword: false }
    expect(result.current.session).toEqual(expected)
    expect(loadStaffSession()).toEqual(expected)
  })

  it('con lo slug accede al ristorante e ricorda la password provvisoria', async () => {
    const token = fakeJwt(3600)
    vi.spyOn(api, 'login').mockResolvedValue({
      access_token: token,
      token_type: 'bearer',
      role: 'WAITER',
      must_change_password: true,
      restaurant_slug: 'da-gino',
    })
    const { result } = renderHook(useAuth, { wrapper })
    await act(() => result.current.login('anna', 'x', 'da-gino'))
    expect(api.login).toHaveBeenCalledWith('anna', 'x', 'da-gino')
    expect(result.current.session).toMatchObject({ restaurant: 'da-gino', mustChangePassword: true })
  })

  it('cambiando la password l’obbligo sparisce, anche nello storage', async () => {
    const token = fakeJwt(3600)
    vi.spyOn(api, 'login').mockResolvedValue({
      access_token: token,
      token_type: 'bearer',
      role: 'WAITER',
      must_change_password: true,
      restaurant_slug: 'da-gino',
    })
    const renewed = fakeJwt(7200)
    vi.spyOn(api, 'changePassword').mockResolvedValue({
      access_token: renewed,
      token_type: 'bearer',
      role: 'WAITER',
      must_change_password: false,
      restaurant_slug: 'da-gino',
    })
    const { result } = renderHook(useAuth, { wrapper })
    await act(() => result.current.login('anna', 'x', 'da-gino'))
    await act(() => result.current.changePassword('x', 'una-nuova-password-1'))
    expect(api.changePassword).toHaveBeenCalledWith('x', 'una-nuova-password-1')
    expect(result.current.session).toMatchObject({ mustChangePassword: false, token: renewed })
    expect(loadStaffSession()?.mustChangePassword).toBe(false)
  })

  it('credenziali errate: l’errore passa al chiamante e non si resta collegati', async () => {
    vi.spyOn(api, 'login').mockRejectedValue(new ApiError(401, 'Credenziali non valide'))
    const { result } = renderHook(useAuth, { wrapper })
    await expect(act(() => result.current.login('mario', 'no'))).rejects.toThrow('Credenziali non valide')
    expect(result.current.session).toBeNull()
    expect(localStorage.getItem('cg:staff')).toBeNull()
  })

  it('password reimpostata mentre si è collegati: il 403 del server porta al cambio obbligatorio', async () => {
    localStorage.setItem(
      'cg:staff',
      JSON.stringify({ token: fakeJwt(3600), role: 'WAITER', username: 'anna', restaurant: 'da-gino' }),
    )
    const body = JSON.stringify({ detail: 'Devi cambiare la password prima di continuare' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 403 })))
    const { result } = renderHook(useAuth, { wrapper })
    expect(result.current.session?.mustChangePassword).toBeUndefined()
    await act(() => api.staff.tables.list().catch(() => undefined))
    expect(result.current.session?.mustChangePassword).toBe(true)
    expect(loadStaffSession()?.mustChangePassword).toBe(true)
  })

  it('un altro 403 non cambia la sessione', async () => {
    localStorage.setItem('cg:staff', JSON.stringify({ token: fakeJwt(3600), role: 'WAITER', username: 'anna' }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Permessi insufficienti' }), { status: 403 })))
    const { result } = renderHook(useAuth, { wrapper })
    await act(() => api.staff.tables.list().catch(() => undefined))
    expect(result.current.session?.mustChangePassword).toBeUndefined()
  })

  it('il logout azzera stato e storage', async () => {
    vi.spyOn(api, 'login').mockResolvedValue({
      access_token: fakeJwt(3600),
      token_type: 'bearer',
      role: 'WAITER',
      must_change_password: false,
    })
    const { result } = renderHook(useAuth, { wrapper })
    await act(() => result.current.login('anna', 'x'))
    act(() => result.current.logout())
    expect(result.current.session).toBeNull()
    expect(result.current.notice).toBeNull()
    expect(localStorage.getItem('cg:staff')).toBeNull()
  })

  it('al riavvio riprende il login ancora valido', () => {
    localStorage.setItem(
      'cg:staff',
      JSON.stringify({ token: fakeJwt(3600), role: 'WAITER', username: 'anna' }),
    )
    const { result } = renderHook(useAuth, { wrapper })
    expect(result.current.session?.username).toBe('anna')
  })

  it('al riavvio ignora un token scaduto', () => {
    localStorage.setItem(
      'cg:staff',
      JSON.stringify({ token: fakeJwt(-5), role: 'WAITER', username: 'anna' }),
    )
    const { result } = renderHook(useAuth, { wrapper })
    expect(result.current.session).toBeNull()
  })

  it('quando il token scade a pagina aperta torna al login con un avviso', () => {
    vi.useFakeTimers()
    try {
      localStorage.setItem(
        'cg:staff',
        JSON.stringify({ token: fakeJwt(30, Date.now()), role: 'WAITER', username: 'anna' }),
      )
      const { result } = renderHook(useAuth, { wrapper })
      expect(result.current.session).not.toBeNull()
      act(() => {
        vi.advanceTimersByTime(31_000)
      })
      expect(result.current.session).toBeNull()
      expect(result.current.notice).toBe(SESSION_EXPIRED_NOTICE)
      expect(localStorage.getItem('cg:staff')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('senza provider useAuth segnala l’errore di uso', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Probe = () => {
      useAuth()
      return null
    }
    expect(() => render(<Probe />)).toThrow(/AuthProvider/)
    expect(screen.queryByText('x')).toBeNull()
  })
})
