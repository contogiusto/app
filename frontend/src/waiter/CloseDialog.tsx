import { useMutation } from '@tanstack/react-query'
import { api } from '../api/client'
import { Money } from '../ui/primitives'
import { ErrorNote, Overlay } from './parts'
import { useRefresh } from './queries'

type Props = {
  sessionId: number
  tableNumber: number
  /** Quanto resta da pagare, o null finché i pagamenti non sono stati letti. */
  remainingCents: number | null
  onClose: () => void
}

/** Conferma della chiusura forzata: irreversibile, anche a conto non saldato. */
export function CloseDialog({ sessionId, tableNumber, remainingCents, onClose }: Props) {
  const refresh = useRefresh()
  const close = useMutation({
    mutationFn: () => api.staff.sessions.close(sessionId),
    onSuccess: () => {
      onClose()
    },
    onSettled: () => refresh(),
  })

  return (
    <Overlay
      label={`Chiudere il tavolo ${tableNumber}?`}
      role="alertdialog"
      placement="center"
      onClose={onClose}
    >
      <h3 className="serif" style={{ fontSize: 26, marginBottom: 10 }}>
        Chiudere il tavolo {tableNumber}?
      </h3>
      <p style={{ color: 'var(--ink-2)', fontSize: 14.5, marginBottom: 12 }}>
        La chiusura non si può annullare: nessuno potrà più ordinare o pagare su questa sessione.
      </p>
      {remainingCents !== null && remainingCents > 0 && (
        <p style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}>
          Il conto non è saldato: restano <Money cents={remainingCents} /> da pagare.
        </p>
      )}
      <div style={{ marginBottom: 14 }}>
        <ErrorNote error={close.error} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--ghost" data-autofocus onClick={onClose}>
          Annulla
        </button>
        <button
          type="button"
          className="btn btn--dark"
          disabled={close.isPending}
          onClick={() => close.mutate()}
        >
          Chiudi sessione
        </button>
      </div>
    </Overlay>
  )
}
