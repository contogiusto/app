import { act, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
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
  it('il login salva token, ruolo e utente (anche nello storage)', async () => {
    const token = fakeJwt(3600)
    vi.spyOn(api, 'login').mockResolvedValue({ access_token: token, token_type: 'bearer', role: 'ADMIN' })
    const { result } = renderHook(useAuth, { wrapper })
    expect(result.current.session).toBeNull()

    await act(() => result.current.login('  mario ', 'segreta'))

    expect(api.login).toHaveBeenCalledWith('mario', 'segreta')
    expect(result.current.session).toEqual({ token, role: 'ADMIN', username: 'mario' })
    expect(loadStaffSession()).toEqual({ token, role: 'ADMIN', username: 'mario' })
  })

  it('credenziali errate: l’errore passa al chiamante e non si resta collegati', async () => {
    vi.spyOn(api, 'login').mockRejectedValue(new ApiError(401, 'Credenziali non valide'))
    const { result } = renderHook(useAuth, { wrapper })
    await expect(act(() => result.current.login('mario', 'no'))).rejects.toThrow('Credenziali non valide')
    expect(result.current.session).toBeNull()
    expect(localStorage.getItem('cg:staff')).toBeNull()
  })

  it('il logout azzera stato e storage', async () => {
    vi.spyOn(api, 'login').mockResolvedValue({
      access_token: fakeJwt(3600),
      token_type: 'bearer',
      role: 'WAITER',
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
