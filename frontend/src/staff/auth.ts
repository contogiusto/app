import { createContext, useContext } from 'react'
import type { UserRole } from '../api/client'
import type { StaffSession } from './session'

export const SESSION_EXPIRED_NOTICE = 'Sessione scaduta: accedi di nuovo.'
export type AuthContextValue = {
  /** Chi è collegato, o null. Un token scaduto non compare mai qui. */
  session: StaffSession | null
  /** Perché si è tornati al login (es. sessione scaduta); sparisce al prossimo login. */
  notice: string | null
  login: (username: string, password: string, restaurant?: string) => Promise<StaffSession>
  /** Cambia la propria password; a buon fine toglie l'obbligo di cambiarla. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  logout: (notice?: string) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (value === null) throw new Error('useAuth va usato dentro AuthProvider')
  return value
}

/** Dove porta il login per ciascun ruolo (con il ristorante, se lo staff ne ha uno). */
export const homeFor = (role: UserRole, restaurant?: string | null) => {
  if (role === 'SUPERADMIN') return '/piattaforma'
  const base = restaurant ? `/ristorante/${restaurant}` : ''
  return `${base}${role === 'ADMIN' ? '/admin' : '/waiter'}`
}

/** La pagina dove si cambia la password provvisoria. */
export const CHANGE_PASSWORD_PATH = '/cambio-password'
