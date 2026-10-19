import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/** Guscio di una schermata mobile: intestazione, corpo scorrevole e piede fisso. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <div
      className="paper-grain"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {children}
    </div>
  )
}

type HeadProps = {
  title: string
  sub?: ReactNode
  right?: ReactNode
  onBack?: () => void
}

export function Head({ title, sub, right, onBack }: HeadProps) {
  return (
    <header
      style={{
        padding: '8px 22px 14px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--paper-2)',
      }}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--ink-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 14,
            fontWeight: 600,
            padding: '0 0 8px',
            marginLeft: -4,
          }}
        >
          <Icon name="arrow" size={16} style={{ transform: 'rotate(180deg)' }} /> Indietro
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 32, lineHeight: 1 }}>
            {title}
          </h1>
          {sub && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 5 }}>{sub}</div>}
        </div>
        {right}
      </div>
    </header>
  )
}

export function Body({ children }: { children: ReactNode }) {
  return (
    <main className="scroll" style={{ flex: 1, overflow: 'auto', padding: '16px 18px 20px' }}>
      {children}
    </main>
  )
}

export function Footer({ children }: { children: ReactNode }) {
  return (
    <footer
      style={{
        padding: '14px 18px calc(14px + env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--line)',
        background: 'var(--paper-2)',
      }}
    >
      {children}
    </footer>
  )
}

type CenterMessageProps = {
  icon: IconName
  title: string
  body?: string
  /** Per messaggi che compaiono da soli (es. errori), così li legge anche lo screen reader. */
  role?: 'status' | 'alert'
}

export function CenterMessage({ icon, title, body, role }: CenterMessageProps) {
  return (
    <Screen>
      <main
        role={role}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: '0 36px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 18,
            background: 'var(--paper-3)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-3)',
          }}
        >
          <Icon name={icon} size={28} />
        </div>
        <h2 className="serif" style={{ fontSize: 26 }}>
          {title}
        </h2>
        {body && <p style={{ color: 'var(--ink-2)', fontSize: 14.5, lineHeight: 1.5 }}>{body}</p>}
      </main>
    </Screen>
  )
}
