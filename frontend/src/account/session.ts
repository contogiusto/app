/**
 * Login del cliente nel browser: token JWT (30 giorni) e dati del profilo. Come per lo staff
 * il `exp` si legge dal payload senza verificare la firma (lo fa il server): serve solo a non
 * usare un token che di sicuro verrebbe rifiutato. Se il browser blocca lo storage il login
 * vale per la pagina aperta, senza memoria.
 */

import type { Customer } from '../api/client'
import { isExpired } from '../staff/session'

export type AccountSession = { token: string; customer: Customer }

const KEY = 'cg:account'

export function loadAccountSession(now = Date.now()): AccountSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return null
    const data = JSON.parse(raw) as Partial<AccountSession>
    const c = data.customer
    const valid =
      typeof data.token === 'string' &&
      c !== undefined &&
      typeof c.id === 'number' &&
      typeof c.email === 'string' &&
      typeof c.first_name === 'string' &&
      typeof c.last_name === 'string'
    if (!valid) return null
    return isExpired(data.token as string, now) ? null : (data as AccountSession)
  } catch {
    return null
  }
}

export function saveAccountSession(session: AccountSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // storage pieno o bloccato: si prosegue senza memoria
  }
}

export function clearAccountSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // niente da fare: il login in memoria è già stato azzerato
  }
}
