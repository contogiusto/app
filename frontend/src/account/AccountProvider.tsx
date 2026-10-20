import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api, setCustomerAuth, type Customer, type CustomerAuth } from '../api/client'
import { tokenExpiry } from '../staff/session'
import { ACCOUNT_EXPIRED_NOTICE, AccountContext } from './account'
import {
  clearAccountSession,
  loadAccountSession,
  saveAccountSession,
  type AccountSession,
} from './session'

// setTimeout non regge ritardi oltre 2^31 ms (~24,8 giorni): il token ne dura 30, quindi serve.
const MAX_TIMER_MS = 2 ** 31 - 1

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AccountSession | null>(() => loadAccountSession())
  const [notice, setNotice] = useState<string | null>(null)

  const logout = useCallback((reason?: string) => {
    clearAccountSession()
    setSession(null)
    setNotice(reason ?? null)
  }, [])

  const accept = useCallback((result: CustomerAuth) => {
    const next: AccountSession = { token: result.access_token, customer: result.customer }
    saveAccountSession(next)
    setSession(next)
    setNotice(null)
    return next
  }, [])

  const login = useCallback(
    async (email: string, password: string) => accept(await api.customer.login(email.trim(), password)),
    [accept],
  )

  const register = useCallback(
    async (data: Parameters<typeof api.customer.register>[0]) =>
      accept(await api.customer.register({ ...data, email: data.email.trim() })),
    [accept],
  )

  const setCustomer = useCallback((customer: Customer) => {
    setSession((current) => {
      if (current === null) return current
      const next = { ...current, customer }
      saveAccountSession(next)
      return next
    })
  }, [])

  // Il client legge sempre il token più recente da qui, senza dipendere dai render. Layout effect
  // (come per lo staff): le query dei figli al primo render dopo un ricaricamento girano prima
  // degli effetti del genitore e troverebbero il client senza token.
  const tokenRef = useRef<string | null>(session?.token ?? null)
  useLayoutEffect(() => {
    tokenRef.current = session?.token ?? null
  }, [session])
  useLayoutEffect(() => {
    setCustomerAuth({
      getToken: () => {
        const token = tokenRef.current
        const expiry = token === null ? null : tokenExpiry(token)
        return token !== null && expiry !== null && expiry > Date.now() ? token : null
      },
      onUnauthorized: () => logout(ACCOUNT_EXPIRED_NOTICE),
    })
    return () => setCustomerAuth(null)
  }, [logout])

  // Allo scadere del token si esce anche se la pagina resta ferma.
  useEffect(() => {
    if (session === null) return
    const expiry = tokenExpiry(session.token)
    const wait = expiry === null ? 0 : Math.min(Math.max(expiry - Date.now(), 0), MAX_TIMER_MS)
    const timer = setTimeout(() => logout(ACCOUNT_EXPIRED_NOTICE), wait)
    return () => clearTimeout(timer)
  }, [session, logout])

  const value = useMemo(
    () => ({ session, notice, login, register, logout, setCustomer }),
    [session, notice, login, register, logout, setCustomer],
  )
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}
