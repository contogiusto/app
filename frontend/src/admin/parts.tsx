import type { ReactNode } from 'react'

/** Titolo di sezione con sottotitolo e azione principale (come `Header` del prototipo). */
export function SectionHeader({
  title,
  sub,
  action,
}: {
  title: string
  sub?: string
  action?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 26,
        gap: 16,
      }}
    >
      <div>
        <h2 className="serif" style={{ fontSize: 38, lineHeight: 1 }}>
          {title}
        </h2>
        {sub && <p style={{ color: 'var(--ink-3)', fontSize: 13.5, marginTop: 7 }}>{sub}</p>}
      </div>
      {action}
    </div>
  )
}

/** Interruttore on/off (role="switch"): `label` dice allo screen reader cosa cambia. */
export function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        width: 42,
        height: 25,
        borderRadius: 99,
        border: 'none',
        padding: 3,
        background: on ? 'var(--olive)' : 'var(--line-2)',
        transition: 'background .2s',
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          display: 'block',
          width: 19,
          height: 19,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: 'var(--shadow-sm)',
          transform: on ? 'translateX(17px)' : 'none',
          transition: 'transform .2s var(--ease)',
        }}
      />
    </button>
  )
}

/** Errore dell'API sotto un modulo o in cima a un elenco. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      style={{
        color: 'var(--clay-deep)',
        background: 'var(--clay-tint)',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 14,
        lineHeight: 1.4,
      }}
    >
      {children}
    </p>
  )
}
