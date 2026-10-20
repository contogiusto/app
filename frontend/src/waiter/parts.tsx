import { useEffect, useRef, type ReactNode } from 'react'

/** Errore dell'API (messaggio già in italiano), annunciato dagli screen reader. */
export function ErrorNote({ error }: { error: Error | null | undefined }) {
  if (!error) return null
  return (
    <div
      role="alert"
      style={{
        padding: '10px 14px',
        borderRadius: 'var(--r-md)',
        background: 'var(--clay-tint)',
        color: 'var(--clay-deep)',
        fontSize: 13.5,
        fontWeight: 600,
      }}
    >
      {error.message}
    </div>
  )
}

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'

type OverlayProps = {
  /** Nome della finestra per chi usa lo screen reader. */
  label: string
  role?: 'dialog' | 'alertdialog'
  /** A destra una scheda a tutta altezza, al centro una finestra di conferma. */
  placement: 'right' | 'center'
  onClose: () => void
  children: ReactNode
}

/**
 * Finestra modale: Esc e clic sullo sfondo la chiudono, Tab resta al suo interno e il focus
 * torna dov'era alla chiusura. All'apertura il focus va al primo elemento con `data-autofocus`.
 */
export function Overlay({ label, role = 'dialog', placement, onClose, children }: OverlayProps) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const node = panel.current
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node
    first?.focus()
    return () => previous?.focus()
  }, [])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close.current()
    } else if (event.key === 'Tab' && panel.current) {
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <div className={`waiter__overlay waiter__overlay--${placement}`} onClick={onClose}>
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="waiter__panel"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  )
}
