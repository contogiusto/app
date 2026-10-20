import type { ReactNode } from 'react'
import { Icon } from '../ui/Icon'
import { useAuth } from './auth'

const ROLE_LABEL = { ADMIN: 'Ristoratore', WAITER: 'Cameriere' } as const

type Props = {
  title: string
  /** Pulsanti o navigazione a destra, prima del nome utente. */
  actions?: ReactNode
  children: ReactNode
}

/** Guscio comune delle schermate staff: barra con titolo, utente, ruolo e "Esci". */
export function StaffLayout({ title, actions, children }: Props) {
  const { session, logout } = useAuth()
  return (
    <div className="paper-grain" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 22px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--paper-2)',
        }}
      >
        <h1 className="serif" style={{ fontSize: 26, lineHeight: 1, flex: 1 }}>
          {title}
        </h1>
        {actions}
        {session && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{session.username}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{ROLE_LABEL[session.role]}</div>
            </div>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ padding: '9px 15px', fontSize: 13 }}
              onClick={() => logout()}
            >
              <Icon name="lock" size={15} /> Esci
            </button>
          </div>
        )}
      </header>
      <main className="scroll" style={{ flex: 1, overflow: 'auto', padding: '20px 22px' }}>
        {children}
      </main>
    </div>
  )
}
