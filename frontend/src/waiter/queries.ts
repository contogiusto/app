import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from '../api/client'

const POLL_MS = 3000

/** Con un 4xx il problema non passa da solo: inutile continuare a chiedere. */
const poll = (query: { state: { error: Error | null } }) => {
  const error = query.state.error
  return error instanceof ApiError && error.status >= 400 && error.status < 500 ? false : POLL_MS
}

export const useTables = () =>
  useQuery({ queryKey: ['waiter', 'tables'], queryFn: api.staff.tables.list, refetchInterval: poll })

export const useOpenSessions = () =>
  useQuery({
    queryKey: ['waiter', 'open'],
    queryFn: api.staff.sessions.listOpen,
    refetchInterval: poll,
  })

/** Dati di una sessione: i tre elenchi si aggiornano da soli, come la vista del cliente. */
export function useSessionData(sessionId: number) {
  const session = useQuery({
    queryKey: ['waiter', 'session', sessionId],
    queryFn: () => api.staff.sessions.get(sessionId),
    refetchInterval: poll,
  })
  const orders = useQuery({
    queryKey: ['waiter', 'orders', sessionId],
    queryFn: () => api.staff.orders.list(sessionId),
    refetchInterval: poll,
  })
  const payments = useQuery({
    queryKey: ['waiter', 'payments', sessionId],
    queryFn: () => api.staff.payments.list(sessionId),
    refetchInterval: poll,
  })
  return { session, orders, payments }
}

/** Il menu pubblico (solo piatti disponibili) cambia di rado: basta rileggerlo ogni tanto. */
export const useMenu = () =>
  useQuery({ queryKey: ['menu'], queryFn: api.menu, staleTime: 30_000 })

/** Dopo una scrittura si rileggono subito tutti i dati della sala, senza aspettare il polling. */
export function useRefresh() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['waiter'] })
}
