import { createContext, useContext } from 'react'
import type { Customer, CustomerRegister } from '../api/client'
import type { AccountSession } from './session'

export const ACCOUNT_EXPIRED_NOTICE = 'Sessione scaduta: accedi di nuovo.'

export type AccountContextValue = {
  /** Il cliente collegato, o null (ospite). Un token scaduto non compare mai qui. */
  session: AccountSession | null
  /** Perché si è usciti (es. sessione scaduta); sparisce al prossimo login. */
  notice: string | null
  login: (email: string, password: string) => Promise<AccountSession>
  register: (data: CustomerRegister) => Promise<AccountSession>
  logout: (notice?: string) => void
  /** Dopo una modifica del profilo: aggiorna i dati che l'app mostra e ricorda. */
  setCustomer: (customer: Customer) => void
}

export const AccountContext = createContext<AccountContextValue | null>(null)

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext)
  if (value === null) throw new Error('useAccount va usato dentro AccountProvider')
  return value
}
