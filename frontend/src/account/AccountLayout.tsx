import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAccount } from './account'

/** Segnaposto del guscio dell'area cliente (intestazione e navigazione): da rifinire. */
export default function AccountLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useAccount()
  return (
    <div className="paper-grain" style={{ minHeight: '100%' }}>
      <header style={{ display: 'flex', gap: 16, padding: 16, alignItems: 'center' }}>
        <strong>{session?.customer.first_name}</strong>
        <nav style={{ display: 'flex', gap: 12 }}>
          <NavLink to="/customer/home">Home</NavLink>
          <NavLink to="/customer/history">Storico</NavLink>
          <NavLink to="/customer/profile">Profilo</NavLink>
          <NavLink to="/customer/scan">Scansiona QR</NavLink>
        </nav>
        <button type="button" onClick={() => logout()}>
          Esci
        </button>
      </header>
      <main style={{ padding: 16 }}>{children}</main>
    </div>
  )
}
