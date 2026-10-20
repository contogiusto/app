import { render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { AuthProvider } from './AuthProvider'
import { fakeJwt } from './testing'

function FirstRequest() {
  // Come una query al primo render dopo il ricaricamento della pagina: parte nell'effetto del figlio.
  useEffect(() => {
    void api.staff.tables.list().catch(() => undefined)
  }, [])
  return null
}

describe('AuthProvider al ricaricamento della pagina', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    localStorage.setItem('cg:staff', JSON.stringify({ token: fakeJwt(3600), role: 'ADMIN', username: 'u' }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('la prima richiesta di un componente figlio porta già il token', async () => {
    render(
      <AuthProvider>
        <FirstRequest />
      </AuthProvider>,
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toMatch(/^Bearer /)
  })
})
