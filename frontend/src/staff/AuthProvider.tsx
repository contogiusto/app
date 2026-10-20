import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, setStaffAuth } from '../api/client'
import { AuthContext, SESSION_EXPIRED_NOTICE } from './auth'
import {
  clearStaffSession,
  loadStaffSession,
  saveStaffSession,
  tokenExpiry,
  type StaffSession,
} from './session'

// setTimeout non regge ritardi oltre 2^31 ms (~24,8 giorni): più del token, ma si protegge lo stesso.
const MAX_TIMER_MS = 2 ** 31 - 1

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StaffSession | null>(() => loadStaffSession())
  const [notice, setNotice] = useState<string | null>(null)

  const logout = useCallback((reason?: string) => {
    clearStaffSession()
    setSession(null)
    setNotice(reason ?? null)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const name = username.trim()
    const result = await api.login(name, password)
    const next: StaffSession = { token: result.access_token, role: result.role, username: name }
    saveStaffSession(next)
    setSession(next)
    setNotice(null)
    return next
  }, [])

  // Il client legge sempre il token più recente da qui, senza dipendere dai render. Si imposta in
  // un layout effect: gli effetti dei figli (es. le query avviate al primo render dopo un
  // ricaricamento della pagina) girano prima di quelli del genitore e troverebbero il client
  // senza token.
  const tokenRef = useRef<string | null>(session?.token ?? null)
  useLayoutEffect(() => {
    tokenRef.current = session?.token ?? null
  }, [session])
  useLayoutEffect(() => {
    setStaffAuth({
      getToken: () => {
        const token = tokenRef.current
        const expiry = token === null ? null : tokenExpiry(token)
        return token !== null && expiry !== null && expiry > Date.now() ? token : null
      },
      onUnauthorized: () => logout(SESSION_EXPIRED_NOTICE),
    })
    return () => setStaffAuth(null)
  }, [logout])

  // Allo scadere del token si torna al login anche se la pagina resta ferma.
  useEffect(() => {
    if (session === null) return
    const expiry = tokenExpiry(session.token)
    const wait = expiry === null ? 0 : Math.min(Math.max(expiry - Date.now(), 0), MAX_TIMER_MS)
    const timer = setTimeout(() => logout(SESSION_EXPIRED_NOTICE), wait)
    return () => clearTimeout(timer)
  }, [session, logout])

  const value = useMemo(
    () => ({ session, notice, login, logout }),
    [session, notice, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

