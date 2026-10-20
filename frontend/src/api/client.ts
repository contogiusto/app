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
export type UserRole = Schemas['UserRole']
export type StaffTable = Schemas['TableOut']
export type StaffSession = Schemas['SessionOut']
export type OpenSession = Schemas['OpenSessionOut']
export type OrderItem = Schemas['OrderItemOut']
export type OrderList = Schemas['OrderListOut']
export type PaymentList = Schemas['PaymentListOut']
export type MenuItemIn = Schemas['MenuItemIn']

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
  /** Come leggere la risposta: JSON (default) o file binario (es. il QR in SVG). */
  as?: 'json' | 'blob'
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
  const { method = 'GET', body, headers = {}, signal, as = 'json' } = options
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
  return (as === 'blob' ? await response.blob() : await response.json()) as T
}

/**
 * Collegamento con lo stato di login dello staff (lo imposta `AuthProvider`). Sta qui, e non
 * nel contesto React, perché il client è usato anche fuori dai componenti.
 */
type StaffAuthHandlers = {
  /** Token da usare, o null se non c'è o è già scaduto. */
  getToken: () => string | null
  /** Chiamato quando la sessione non vale più (401 o token scaduto): fa il logout. */
  onUnauthorized: () => void
}
let staffAuth: StaffAuthHandlers | null = null

export function setStaffAuth(handlers: StaffAuthHandlers | null) {
  staffAuth = handlers
}

const SESSION_EXPIRED = 'Sessione scaduta: accedi di nuovo'

/** Richiesta autenticata: aggiunge il token e, su 401, riporta lo staff al login. */
async function authed<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = staffAuth?.getToken() ?? null
  if (token === null) {
    staffAuth?.onUnauthorized()
    throw new ApiError(401, SESSION_EXPIRED)
  }
  try {
    return await request<T>(path, { ...options, headers: { ...options.headers, ...bearer(token) } })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) staffAuth?.onUnauthorized()
    throw error
  }
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
// Il token del QR viaggia in un header, non nell'URL, per restare fuori dai log di accesso.
const tableToken = (token: string) => ({ 'X-Table-Token': token })

export const api = {
  login: (username: string, password: string) =>
    request<TokenResponse>('/api/auth/login', { method: 'POST', body: { username, password } }),

  me: (token: string) => request<UserOut>('/api/auth/me', { headers: bearer(token) }),

  menu: () => request<MenuItemOut[]>('/api/menu'),

  /**
   * Percorso staff (cameriere e ristoratore): richieste col token del login corrente.
   * Le scritture di menu e tavoli, e il QR, sono solo per ADMIN (altrimenti 403).
   */
  staff: {
    tables: {
      list: () => authed<StaffTable[]>('/api/tables'),
      create: (number: number) => authed<StaffTable>('/api/tables', { method: 'POST', body: { number } }),
      regenerateQr: (tableId: number) =>
        authed<void>(`/api/tables/${tableId}/qr/regenerate`, { method: 'POST' }),
      /** L'SVG del QR richiede l'header Authorization: un <img src> non lo manda, quindi si
       * scarica come file; per mostrarlo vedi `useQrUrl`. */
      qr: (tableId: number) => authed<Blob>(`/api/tables/${tableId}/qr.svg`, { as: 'blob' }),
    },

    sessions: {
      open: (tableId: number, coperti: number) =>
        authed<StaffSession>('/api/sessions', {
          method: 'POST',
          body: { table_id: tableId, coperti },
        }),
      /** Tutte le sessioni aperte con importi e contanti da confermare, in una sola richiesta. */
      listOpen: () => authed<OpenSession[]>('/api/sessions/open'),
      get: (sessionId: number) => authed<StaffSession>(`/api/sessions/${sessionId}`),
      setMode: (sessionId: number, paymentMode: PaymentMode) =>
        authed<StaffSession>(`/api/sessions/${sessionId}/mode`, {
          method: 'PUT',
          body: { payment_mode: paymentMode },
        }),
      close: (sessionId: number) =>
        authed<StaffSession>(`/api/sessions/${sessionId}/close`, { method: 'POST' }),
    },

    orders: {
      list: (sessionId: number) => authed<OrderList>(`/api/sessions/${sessionId}/orders`),
      add: (sessionId: number, menuItemId: number, quantity: number) =>
        authed<OrderItem>(`/api/sessions/${sessionId}/orders`, {
          method: 'POST',
          body: { menu_item_id: menuItemId, quantity },
        }),
      remove: (sessionId: number, itemId: number) =>
        authed<void>(`/api/sessions/${sessionId}/orders/${itemId}`, { method: 'DELETE' }),
    },

    payments: {
      list: (sessionId: number) => authed<PaymentList>(`/api/sessions/${sessionId}/payments`),
      create: (sessionId: number, payment: PaymentIn) =>
        authed<PaymentOut>(`/api/sessions/${sessionId}/payments`, {
          method: 'POST',
          body: payment,
        }),
      confirmCash: (paymentId: number) =>
        authed<PaymentOut>(`/api/payments/${paymentId}/confirm`, { method: 'PUT' }),
    },

    /** Il menu pubblico (solo piatti disponibili) è `api.menu()`; qui quello completo. */
    menu: {
      all: () => authed<MenuItemOut[]>('/api/menu/all'),
      create: (item: MenuItemIn) =>
        authed<MenuItemOut>('/api/menu', { method: 'POST', body: item }),
      update: (itemId: number, item: MenuItemIn) =>
        authed<MenuItemOut>(`/api/menu/${itemId}`, { method: 'PUT', body: item }),
      remove: (itemId: number) => authed<void>(`/api/menu/${itemId}`, { method: 'DELETE' }),
    },
  },

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
