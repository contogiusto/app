import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../api/client'

/**
 * Indirizzo (blob:) con cui mostrare il QR di un tavolo in un <img>. L'SVG richiede il token
 * Bearer, che un <img src> non può mandare: si scarica con il client e si espone come file
 * locale. Dopo `api.staff.tables.regenerateQr` invalida la chiave `['qr', tableId]`.
 */
export function useQrUrl(tableId: number) {
  const query = useQuery({
    queryKey: ['qr', tableId],
    queryFn: () => api.staff.tables.qr(tableId),
    staleTime: Infinity,
  })
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!query.data) return
    const objectUrl = URL.createObjectURL(query.data)
    // L'URL del blob è una risorsa esterna da revocare allo smontaggio: va creato qui.
    // oxlint-disable-next-line react/set-state-in-effect
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [query.data])
  return { url, isLoading: query.isLoading, error: query.error }
}
