import { useEffect, useId, useRef, type ReactNode } from 'react'

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  /** Per le conferme: `alertdialog` fa leggere subito il messaggio. */
  role?: 'dialog' | 'alertdialog'
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled])'

/**
 * Finestra modale accessibile: titolo collegato, Esc chiude, il Tab resta dentro la finestra e il
 * focus torna all'elemento che l'ha aperta. Non si chiude cliccando fuori: un modulo mezzo
 * compilato non va perso per un clic sbagliato.
 */
export function Modal({ title, onClose, children, role = 'dialog' }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const node = ref.current
    // Il primo campo (o, nelle conferme, il primo pulsante) prende il focus all'apertura.
    node?.querySelector<HTMLElement>('input, select, button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)]
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
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [])

  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className="card modal-panel"
      >
        <h2 id={titleId} className="display" style={{ fontSize: 20, marginBottom: 20 }}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
