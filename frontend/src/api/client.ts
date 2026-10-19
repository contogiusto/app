/**
 * Client tipizzato dell'API. I tipi arrivano da `schema.d.ts`, generato dall'OpenAPI del
 * backend (`npm run api:types`): se l'API cambia e i tipi no, la CI lo segnala.
 */

import type { components } from './schema'

type Schemas = components['schemas']

export type TokenResponse = Schemas['TokenResponse']
export type UserOut = Schemas['UserOut']
export type MenuItemOut = Schemas['MenuItemOut']
export type PublicTable = Schemas['PublicTableOut']
export type PublicSession = Schemas['PublicSessionOut']
export type PaymentIn = Schemas['PaymentIn']
export type PaymentOut = Schemas['PaymentOut']
export type PaymentMode = Schemas['ModeIn']['payment_mode']

/** Errore restituito dall'API (o di rete, con status 0). `message` è già pronto per l'utente. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

const BASE_URL = import.meta.env.VITE_API_BASE ?? ''

async function detailOf(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json()
    const detail = (data as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return 'Dati non validi'
  } catch {
    // corpo assente o non JSON (es. errore 500 del server): si usa il messaggio generico
  }
  return `Errore del server (${response.status})`
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, signal } = options
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'Connessione assente: riprova tra poco')
  }
  if (!response.ok) throw new ApiError(response.status, await detailOf(response))
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
// Il token del QR viaggia in un header, non nell'URL, per restare fuori dai log di accesso.
const tableToken = (token: string) => ({ 'X-Table-Token': token })

export const api = {
  login: (username: string, password: string) =>
    request<TokenResponse>('/api/auth/login', { method: 'POST', body: { username, password } }),

  me: (token: string) => request<UserOut>('/api/auth/me', { headers: bearer(token) }),

  menu: () => request<MenuItemOut[]>('/api/menu'),

  /** Percorso cliente: si accede col tavolo e il token del QR, senza account. */
  table: {
    view: (tableId: number, token: string, signal?: AbortSignal) =>
      request<PublicTable>(`/api/public/tables/${tableId}`, {
        headers: tableToken(token),
        signal,
      }),

    setMode: (tableId: number, token: string, paymentMode: PaymentMode) =>
      request<PublicTable>(`/api/public/tables/${tableId}/mode`, {
        method: 'PUT',
        headers: tableToken(token),
        body: { payment_mode: paymentMode },
      }),

    pay: (tableId: number, token: string, payment: PaymentIn) =>
      request<PaymentOut>(`/api/public/tables/${tableId}/payments`, {
        method: 'POST',
        headers: tableToken(token),
        body: payment,
      }),
  },
}
