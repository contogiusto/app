import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAccount } from './account'

/** Storico del cliente collegato; la chiave contiene l'id così un altro cliente non vede la cache. */
export function usePayments() {
  const { session } = useAccount()
  return useQuery({
    queryKey: ['customer', 'payments', session?.customer.id ?? null],
    queryFn: () => api.customer.payments(),
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
