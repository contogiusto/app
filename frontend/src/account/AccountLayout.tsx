import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from '../ui/Icon'
import { Initial } from '../ui/primitives'
import { useAccount } from './account'
import './account.css'

const LINKS: { to: string; label: string; icon: IconName }[] = [
  { to: '/customer/home', label: 'Home', icon: 'table' },
  { to: '/customer/history', label: 'Storico', icon: 'receipt' },
  { to: '/customer/profile', label: 'Profilo', icon: 'lock' },
  { to: '/customer/scan', label: 'Scansiona QR', icon: 'qr' },
]

function Links({ label }: { label: string }) {
  return (
    <nav aria-label={label} className={label === 'Principale' ? 'acc-nav' : 'acc-bottom'}>
      {LINKS.map((link) => (
        <NavLink key={link.to} to={link.to}>
          <Icon name={link.icon} size={18} /> {link.label}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * Guscio dell'area cliente: intestazione con nome e "Esci", navigazione in alto (desktop) o in
 * basso (telefono). Le due navigazioni hanno etichette diverse e una sola è visibile alla volta.
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useAccount()
  const name = session ? `${session.customer.first_name} ${session.customer.last_name}` : ''
  return (
    <div className="paper-grain acc" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header className="acc-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Initial name={name} size={34} />
          <strong style={{ fontSize: 15 }}>{session?.customer.first_name}</strong>
        </div>
        <Links label="Principale" />
        <button
          type="button"
          className="btn btn--ghost"
          style={{ padding: '9px 15px', fontSize: 13, marginLeft: 'auto' }}
          onClick={() => logout()}
        >
          Esci
        </button>
      </header>
      <main className="scroll" style={{ flex: 1, overflow: 'auto', padding: '20px 22px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>{children}</div>
      </main>
      <Links label="Navigazione mobile" />
    </div>
  )
}
