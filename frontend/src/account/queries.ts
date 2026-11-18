import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAccount } from './account'

/**
 * Storico del cliente collegato (con `restaurant`, solo quel ristorante); la chiave contiene l'id
 * così un altro cliente non vede la cache.
 */
export function usePayments(restaurant?: string) {
  const { session } = useAccount()
  return useQuery({
    queryKey: ['customer', 'payments', session?.customer.id ?? null, restaurant ?? null],
    queryFn: () => (restaurant ? api.customer.payments(restaurant) : api.customer.payments()),
    enabled: session !== null,
  })
}

/** I ristoranti dove il cliente ha pagato. */
export function useVisitedRestaurants() {
  const { session } = useAccount()
  return useQuery({
    queryKey: ['customer', 'restaurants', session?.customer.id ?? null],
    queryFn: () => api.customer.restaurants(),
    enabled: session !== null,
  })
}

const dateTime = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
