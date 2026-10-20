import { createContext, useContext } from 'react'
import type { UserRole } from '../api/client'
import type { StaffSession } from './session'

export const SESSION_EXPIRED_NOTICE = 'Sessione scaduta: accedi di nuovo.'
export type AuthContextValue = {
  /** Chi è collegato, o null. Un token scaduto non compare mai qui. */
  session: StaffSession | null
  /** Perché si è tornati al login (es. sessione scaduta); sparisce al prossimo login. */
  notice: string | null
  login: (username: string, password: string) => Promise<StaffSession>
  logout: (notice?: string) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (value === null) throw new Error('useAuth va usato dentro AuthProvider')
  return value
}

/** Dove porta il login per ciascun ruolo. */
export const homeFor = (role: UserRole) => (role === 'ADMIN' ? '/admin' : '/waiter')
