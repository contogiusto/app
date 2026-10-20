import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAccount } from './account'
import { loginUrl } from './redirect'

/** Guardia dell'area del cliente: senza login si va alla home di accesso, con ritorno qui. */
export function RequireCustomer({ children }: { children: ReactNode }) {
  const { session } = useAccount()
  const location = useLocation()
  if (session === null) {
    return <Navigate to={loginUrl(location.pathname + location.search)} replace />
  }
  return children
}
