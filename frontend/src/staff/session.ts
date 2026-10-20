/**
 * Login dello staff nel browser: token JWT, ruolo e nome utente. Il token dura 24 h; il campo
 * `exp` si legge dal payload senza verificare la firma (lo fa il server): serve solo a non
 * usare un token che di sicuro verrebbe rifiutato. Se il browser blocca lo storage il login
 * vale per la pagina aperta, senza memoria.
 */

import type { UserRole } from '../api/client'

export type StaffSession = { token: string; role: UserRole; username: string }

const KEY = 'cg:staff'

/** Scadenza (in millisecondi) letta dal payload del JWT; null se illeggibile. */
export function tokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)),
    )
    const exp = (JSON.parse(json) as { exp?: unknown }).exp
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

/** Un token senza `exp` leggibile si considera scaduto: meglio rifare il login. */
export function isExpired(token: string, now = Date.now()): boolean {
  const expiry = tokenExpiry(token)
  return expiry === null || expiry <= now
}

export function loadStaffSession(now = Date.now()): StaffSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return null
    const data = JSON.parse(raw) as Partial<StaffSession>
    const validRole = data.role === 'ADMIN' || data.role === 'WAITER'
    if (typeof data.token !== 'string' || typeof data.username !== 'string' || !validRole) {
      return null
    }
    return isExpired(data.token, now) ? null : (data as StaffSession)
  } catch {
    return null
  }
}

export function saveStaffSession(session: StaffSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // storage pieno o bloccato: si prosegue senza memoria
  }
}

export function clearStaffSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // niente da fare: il login in memoria è già stato azzerato
  }
}
