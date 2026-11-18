import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import type { UserRole } from '../api/client'
import { CHANGE_PASSWORD_PATH, homeFor, useAuth } from './auth'

/**
 * Guardia delle rotte staff. Anonimo → login (con ritorno alla pagina richiesta);
 * ruolo non ammesso (es. WAITER su /admin) → la sua pagina.
 */
export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { session } = useAuth()
  const location = useLocation()
  const { slug } = useParams()
  if (session === null) {
    // Dentro un ristorante il login è quello del ristorante; altrimenti quello generico.
    const login = slug ? `/ristorante/${slug}/accesso` : '/staff/login'
    return <Navigate to={login} replace state={{ from: location.pathname + location.search }} />
  }
  if (session.mustChangePassword) return <Navigate to={CHANGE_PASSWORD_PATH} replace />
  // Vecchio indirizzo (/admin, /waiter): si porta lo staff nel suo ristorante.
  const legacy = location.pathname.startsWith('/admin') || location.pathname.startsWith('/waiter')
  if (!slug && legacy && session.restaurant && session.role !== 'SUPERADMIN') {
    return <Navigate to={`/ristorante/${session.restaurant}${location.pathname}`} replace />
  }
  // Uno staff entra solo nel proprio ristorante: lo slug dell'URL deve essere il suo.
  const foreign = Boolean(slug && session.role !== 'SUPERADMIN' && session.restaurant !== slug)
  if (!roles.includes(session.role) || foreign) {
    return <Navigate to={homeFor(session.role, session.restaurant)} replace />
  }
  return children
}

/** Rotte per chiunque sia collegato (qualsiasi ruolo); da anonimo si va al login. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  if (session === null) return <Navigate to="/staff/login" replace />
  return children
}
