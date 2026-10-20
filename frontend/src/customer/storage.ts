/**
 * Cosa ricorda il browser del cliente: il token del QR, chi è (per sessione) e il suo pagamento.
 * Serve a non ripetere il nome a ogni ricaricamento. Se il browser blocca lo storage
 * l'app funziona lo stesso, solo senza memoria.
 */

import type { PaymentIn } from '../api/client'

/** `account`: il nome viene dall'account collegato (non digitato): se si esce non vale più. */
export type Identity = { sessionId: number; name: string; account?: boolean }
export type GuestChoice = { sessionId: number }
export type MyPayment = {
  sessionId: number
  amount: string
  method: PaymentIn['method']
  paidAt: number
}

/** Dopo questo tempo un pagamento ricordato non vale più per il messaggio "tavolo saldato". */
const PAYMENT_MEMORY_MS = 6 * 60 * 60 * 1000

const key = (tableId: number, name: string) => `cg:${tableId}:${name}`

function read<T>(tableId: number, name: string): T | null {
  try {
    const raw = localStorage.getItem(key(tableId, name))
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

function write(tableId: number, name: string, value: unknown) {
  try {
    localStorage.setItem(key(tableId, name), JSON.stringify(value))
  } catch {
    // storage pieno o bloccato: si prosegue senza memoria
  }
}

export const loadToken = (tableId: number) => read<string>(tableId, 'token')
export const saveToken = (tableId: number, token: string) => write(tableId, 'token', token)

export const loadIdentity = (tableId: number) => read<Identity>(tableId, 'identity')
export const saveIdentity = (tableId: number, identity: Identity) =>
  write(tableId, 'identity', identity)

export const clearIdentity = (tableId: number) => {
  try {
    localStorage.removeItem(key(tableId, 'identity'))
  } catch {
    // storage bloccato: niente da cancellare
  }
}

/** "Continua come ospite": vale per la sessione del tavolo in cui è stato scelto, non per sempre. */
export const loadGuest = (tableId: number) => read<GuestChoice>(tableId, 'guest')
export const saveGuest = (tableId: number, choice: GuestChoice) => write(tableId, 'guest', choice)

export function loadMyPayment(tableId: number, now = Date.now()): MyPayment | null {
  const payment = read<MyPayment>(tableId, 'payment')
  return payment && now - payment.paidAt < PAYMENT_MEMORY_MS ? payment : null
}
export const saveMyPayment = (tableId: number, payment: MyPayment) =>
  write(tableId, 'payment', payment)
