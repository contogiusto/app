import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { ApiError, api, type StaffTable } from '../api/client'
import { Icon } from '../ui/Icon'
import { useQrUrl } from '../staff/useQrUrl'
import { AdminIcon } from './icons'
import { Modal } from './Modal'
import { ErrorNote, SectionHeader } from './parts'

const TABLES_KEY = ['admin', 'tables'] as const

const messageOf = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Qualcosa è andato storto: riprova'

export function TablesScreen() {
  const tables = useQuery({ queryKey: TABLES_KEY, queryFn: () => api.staff.tables.list() })
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)

  if (tables.isPending) return <p role="status">Caricamento dei tavoli…</p>
  if (tables.isError) return <ErrorNote>{messageOf(tables.error)}</ErrorNote>

  const list = tables.data
  const occupied = list.filter((table) => table.open_session_id !== null).length

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '10px 16px' }}>
      <SectionHeader
        title="Tavoli & QR"
        sub={`${list.length} ${list.length === 1 ? 'tavolo' : 'tavoli'} · ${occupied} occupati`}
        action={
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            <Icon name="plus" size={17} /> Nuovo tavolo
          </button>
        }
      />
      {list.length === 0 && (
        <p style={{ color: 'var(--ink-2)' }}>Non ci sono tavoli: aggiungi il primo.</p>
      )}
      <ul
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(196px, 1fr))',
          gap: 16,
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {list.map((table) => (
          <li key={table.id}>
            <TableCard table={table} />
          </li>
        ))}
      </ul>
      {creating && (
        <NewTable
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            void queryClient.invalidateQueries({ queryKey: TABLES_KEY })
          }}
        />
      )}
    </div>
  )
}

function TableCard({ table }: { table: StaffTable }) {
  const queryClient = useQueryClient()
  const qr = useQrUrl(table.id)
  const [confirming, setConfirming] = useState(false)
  const [printing, setPrinting] = useState(false)
  const busy = table.open_session_id !== null

  // Il foglio da stampare esiste solo mentre si stampa: window.print() è bloccante nei browser
  // desktop, `afterprint` lo toglie anche dove non lo è.
  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(false)
    window.addEventListener('afterprint', done)
    window.print()
    return () => window.removeEventListener('afterprint', done)
  }, [printing])

  return (
    <div
      className="card"
      style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
    >
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="tnum" style={{ fontWeight: 700, fontSize: 15 }}>
          Tavolo {table.number}
        </h3>
        <span
          className={`chip ${busy ? 'chip--amber' : 'chip--olive'}`}
          style={{ fontSize: 10.5, padding: '3px 9px' }}
        >
          {busy ? 'Occupato' : 'Libero'}
        </span>
      </div>
      <div
        style={{
          width: 140,
          height: 140,
          padding: 10,
          background: 'var(--paper-3)',
          borderRadius: 12,
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontSize: 12.5,
          color: 'var(--ink-3)',
        }}
      >
        {qr.url ? (
          <img src={qr.url} alt={`QR del tavolo ${table.number}`} style={{ width: '100%', height: '100%' }} />
        ) : qr.error ? (
          <span role="alert">{messageOf(qr.error)}</span>
        ) : (
          <span>Carico il QR…</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, width: '100%' }}>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ flex: 1, minWidth: 0, padding: '9px 6px', fontSize: 12.5, gap: 6 }}
          disabled={!qr.url}
          aria-label={`Stampa il QR del tavolo ${table.number}`}
          onClick={() => (printing ? window.print() : setPrinting(true))}
        >
          <AdminIcon name="print" size={15} /> Stampa
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ flex: 1, minWidth: 0, padding: '9px 6px', fontSize: 12.5, gap: 6 }}
          aria-label={`Rigenera il QR del tavolo ${table.number}`}
          onClick={() => setConfirming(true)}
        >
          <AdminIcon name="refresh" size={15} /> Rigenera
        </button>
      </div>

      {printing && qr.url && createPortal(<PrintSheet number={table.number} qrUrl={qr.url} />, document.body)}

      {confirming && (
        <RegenerateQr
          table={table}
          onClose={() => setConfirming(false)}
          onDone={() => {
            setConfirming(false)
            void queryClient.invalidateQueries({ queryKey: ['qr', table.id] })
          }}
        />
      )}
    </div>
  )
}

/** Foglio da appendere al tavolo: visibile solo in stampa (vedi `admin.css`). */
function PrintSheet({ number, qrUrl }: { number: number; qrUrl: string }) {
  return (
    <div className="print-sheet">
      <h1 className="serif">Tavolo {number}</h1>
      <img src={qrUrl} alt="" />
      <p>Inquadra il QR con la fotocamera per vedere il conto e pagare.</p>
    </div>
  )
}

function RegenerateQr({
  table,
  onClose,
  onDone,
}: {
  table: StaffTable
  onClose: () => void
  onDone: () => void
}) {
  const regenerate = useMutation({
    mutationFn: () => api.staff.tables.regenerateQr(table.id),
    onSuccess: onDone,
  })
  return (
    <Modal title={`Rigenerare il QR del tavolo ${table.number}?`} role="alertdialog" onClose={onClose}>
      <p style={{ color: 'var(--ink-2)', lineHeight: 1.5 }}>
        Il QR attuale smetterà di funzionare subito: chi lo inquadra non potrà più aprire il tavolo.
        Dovrai stampare il nuovo QR e sostituire quello esposto.
      </p>
      {regenerate.isError && (
        <div style={{ marginTop: 16 }}>
          <ErrorNote>{messageOf(regenerate.error)}</ErrorNote>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 26, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Annulla
        </button>
        <button type="button" className="btn" disabled={regenerate.isPending} onClick={() => regenerate.mutate()}>
          Rigenera QR
        </button>
      </div>
    </Modal>
  )
}

function NewTable({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: (number: number) => api.staff.tables.create(number),
    onSuccess: onCreated,
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const number = Number(text)
    if (!/^\d+$/.test(text.trim()) || number < 1 || number > 9999) {
      setError('Il numero del tavolo deve essere un intero da 1 a 9999')
      return
    }
    setError(null)
    create.mutate(number)
  }

  return (
    <Modal title="Nuovo tavolo" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <label className="field-label" htmlFor="table-number">
          Numero del tavolo
        </label>
        <input
          id="table-number"
          className="field tnum"
          inputMode="numeric"
          value={text}
          aria-invalid={error !== null}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
            create.reset()
          }}
          placeholder="Es. 12"
        />
        <div style={{ marginTop: 14 }}>
          {error ? <ErrorNote>{error}</ErrorNote> : create.isError && <ErrorNote>{messageOf(create.error)}</ErrorNote>}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 26, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn" disabled={text.trim() === '' || create.isPending}>
            Crea tavolo
          </button>
        </div>
      </form>
    </Modal>
  )
}
