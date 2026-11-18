import { useParams } from 'react-router-dom'

/**
 * Prefisso delle rotte dello staff: `/ristorante/<slug>` dentro un ristorante, vuoto sulle vecchie
 * rotte `/admin` e `/waiter` (che portano al ristorante dell'utente).
 */
export function useStaffBase(): string {
  const { slug } = useParams()
  return slug ? `/ristorante/${slug}` : ''
}
