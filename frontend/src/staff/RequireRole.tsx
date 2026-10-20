import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { UserRole } from '../api/client'
import { homeFor, useAuth } from './auth'

/**
 * Guardia delle rotte staff. Anonimo → login (con ritorno alla pagina richiesta);
 * ruolo non ammesso (es. WAITER su /admin) → la sua pagina.
 */
export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { session } = useAuth()
  const location = useLocation()
  if (session === null) {
    return (
      <Navigate to="/staff/login" replace state={{ from: location.pathname + location.search }} />
    )
  }
  if (!roles.includes(session.role)) return <Navigate to={homeFor(session.role)} replace />
  return children
}
