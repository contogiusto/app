import { useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import type { OpenSession, StaffTable } from '../api/client'
import { parseMoney } from '../lib/money'
import { Icon } from '../ui/Icon'
import { CenterMessage } from '../ui/layout'
import { OpenSessionPane } from './OpenSessionPane'
import { paidRatio } from './logic'
import { ErrorNote } from './parts'
import { useOpenSessions, useTables } from './queries'
import { SessionPanel } from './SessionPanel'

/** La sala: elenco dei tavoli a sinistra e, a destra, il tavolo scelto. */
export function Floor() {
  const tableId = /^table\/(\d+)$/.exec(useParams()['*'] ?? '')?.[1]
  const tables = useTables()
  const open = useOpenSessions()
  const selected = tableId === undefined ? null : Number(tableId)
  const summaries = new Map((open.data ?? []).map((s) => [s.table_id, s]))
  const table = tables.data?.find((t) => t.id === selected)

  return (
    <div className={`waiter ${selected === null ? '' : 'waiter--detail'}`}>
      <nav className="waiter__rail" aria-label="Tavoli">
        {tables.isPending && <p role="status" style={{ padding: 12, color: 'var(--ink-3)' }}>Caricamento…</p>}
        {tables.error && !tables.data && <ErrorNote error={tables.error} />}
        {tables.data?.length === 0 && (
          <p style={{ padding: 12, color: 'var(--ink-3)', fontSize: 13.5 }}>
            Nessun tavolo: chiedi al ristoratore di crearli.
          </p>
        )}
        {tables.data?.map((t) => (
          <TableRow key={t.id} table={t} summary={summaries.get(t.id)} />
        ))}
      </nav>

      <section className="waiter__detail" aria-label="Dettaglio del tavolo" style={{ minWidth: 0 }}>
        <Link
          to="/waiter"
          className="btn btn--ghost waiter__back"
          style={{ padding: '8px 14px', fontSize: 13, marginBottom: 14 }}
        >
          <Icon name="arrow" size={15} style={{ transform: 'rotate(180deg)' }} /> Tavoli
        </Link>
        {tables.error && tables.data && <ErrorNote error={tables.error} />}
        {selected === null ? (
          <p style={{ color: 'var(--ink-3)', padding: 24 }}>Scegli un tavolo dall’elenco.</p>
        ) : table ? (
          <TableDetail key={table.id} table={table} />
        ) : (
          tables.data && (
            <CenterMessage icon="table" title="Tavolo non trovato" body="Torna all’elenco e scegline un altro." />
          )
        )}
      </section>
    </div>
  )
}

function TableRow({ table, summary }: { table: StaffTable; summary?: OpenSession }) {
  const isOpen = table.open_session_id !== null
  const total = summary ? parseMoney(summary.total) : 0
  const percent = summary ? Math.round(paidRatio(parseMoney(summary.paid_total), total) * 100) : 0
  const cash = summary?.cash_pending ?? 0
  const detail = !isOpen
    ? 'Libero'
    : summary
      ? `${summary.coperti} coperti · ${percent}%`
      : 'Sessione aperta'
  const label = [`Tavolo ${table.number}`, detail, cash > 0 && cashLabel(cash)]
    .filter(Boolean)
    .join(', ')

  return (
    <NavLink to={`/waiter/table/${table.id}`} className="waiter__row" aria-label={label}>
      <div
        className="tnum"
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          flexShrink: 0,
          background: isOpen ? 'var(--accent-tint)' : 'rgba(34,28,21,.05)',
          color: isOpen ? 'var(--accent-deep)' : 'var(--ink-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        {table.number}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>Tavolo {table.number}</div>
        <div style={{ fontSize: 11.5, color: isOpen ? 'var(--olive-deep)' : 'var(--ink-3)' }}>{detail}</div>
        {cash > 0 && (
          <span className="chip chip--amber" style={{ fontSize: 11, padding: '2px 8px', marginTop: 4 }}>
            <Icon name="cash" size={12} /> {cashLabel(cash)}
          </span>
        )}
      </div>
      {isOpen && summary && (
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: total > 0 && percent >= 100 ? 'var(--olive)' : 'var(--amber)',
          }}
        />
      )}
    </NavLink>
  )
}

const cashLabel = (n: number) => `${n} ${n === 1 ? 'contante' : 'contanti'} da confermare`

/**
 * Tavolo libero: si apre una sessione. Occupato: la sessione. Se si chiude mentre la si guarda
 * (da sola, perché tutto è pagato, o per mano di un collega) resta visibile in sola lettura
 * finché non si torna al tavolo.
 */
function TableDetail({ table }: { table: StaffTable }) {
  const openId = table.open_session_id
  const [remembered, setRemembered] = useState(openId)
  // Si regola durante il render (e non in un effetto): niente frame con la sessione sbagliata.
  if (openId !== null && openId !== remembered) setRemembered(openId)

  const sessionId = openId ?? remembered
  if (sessionId === null) return <OpenSessionPane table={table} />
  return (
    <SessionPanel
      key={sessionId}
      sessionId={sessionId}
      table={table}
      onLeave={() => setRemembered(null)}
    />
  )
}
