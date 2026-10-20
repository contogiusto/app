import type { ReactNode } from 'react'

/** Messaggio d'errore (o avviso) che lo screen reader legge appena compare. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      style={{
        margin: '14px 0 0',
        padding: '10px 14px',
        borderRadius: 'var(--r-md)',
        background: 'var(--clay-tint)',
        color: 'var(--clay-deep)',
        fontSize: 13.5,
        fontWeight: 600,
      }}
    >
      {children}
    </p>
  )
}

/** Messaggio neutro (non è un errore): es. "Account eliminato". */
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      style={{
        margin: '14px 0 0',
        padding: '10px 14px',
        borderRadius: 'var(--r-md)',
        background: 'var(--olive-tint)',
        color: 'var(--olive-deep)',
        fontSize: 13.5,
        fontWeight: 600,
      }}
    >
      {children}
    </p>
  )
}

export const GENERIC_ERROR = 'Qualcosa è andato storto: riprova'
