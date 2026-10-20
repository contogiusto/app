import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type PaymentOut, type StaffTable } from '../api/client'
import { parseMoney } from '../lib/money'
import { Icon } from '../ui/Icon'
import { CenterMessage } from '../ui/layout'
import { Initial, Money, Progress } from '../ui/primitives'
import { CloseDialog } from './CloseDialog'
import { modeLabel, paidRatio } from './logic'
import { MenuPicker } from './MenuPicker'
import { ErrorNote } from './parts'
import { useRefresh, useSessionData } from './queries'

// Lo stesso testo che manda il server (409): così prima e dopo l'errore la frase non cambia.
const LOCKED_BY_PAYMENTS = 'Ci sono già pagamenti: gli ordini non si possono più modificare'

type Props = {
  sessionId: number
  table: StaffTable
  /** Si torna al tavolo (libero) dopo aver guardato una sessione ormai chiusa. */
  onLeave: () => void
}

/** Una sessione: comanda, stato dei pagamenti, conferma dei contanti e chiusura forzata. */
export function SessionPanel({ sessionId, table, onLeave }: Props) {
  const { session, orders, payments } = useSessionData(sessionId)
  const refresh = useRefresh()
  const [picking, setPicking] = useState(false)
  const [closing, setClosing] = useState(false)

  const remove = useMutation({
    mutationFn: (itemId: number) => api.staff.orders.remove(sessionId, itemId),
    onSettled: () => refresh(),
  })
  const confirm = useMutation({
    mutationFn: (paymentId: number) => api.staff.payments.confirmCash(paymentId),
    onSettled: () => refresh(),
  })

  if (session.isPending) return <CenterMessage icon="clock" title="Caricamento…" role="status" />
  if (!session.data) {
    return <CenterMessage role="alert" icon="lock" title="Sessione non disponibile" body={session.error?.message} />
  }

  const { coperti, payment_mode: mode } = session.data
  const closed = session.data.status === 'CLOSED'
  const payList = payments.data?.items ?? []
  const hasPayments = payList.length > 0
  const locked = closed || hasPayments
  const items = orders.data?.items ?? []
  const dishes = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalCents = parseMoney(session.data.total)

  return (
    <div>
      <div
        style={{
          padding: '18px 22px',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)',
          background: 'var(--paper-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 className="serif" style={{ fontSize: 30 }}>
              Tavolo {table.number}
            </h2>
            <span className={`chip ${closed ? 'chip--ink' : 'chip--olive'}`}>
              <span className="dot" />
              {closed ? 'Chiusa' : 'Aperta'}
            </span>
            <span className="chip">{modeLabel(mode)}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 7, fontSize: 13, color: 'var(--ink-3)' }}>
            <span>{coperti} coperti</span>
            <span>
              Totale <Money cents={totalCents} />
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {closed ? (
            <button type="button" className="btn btn--ghost" onClick={onLeave}>
              Torna al tavolo
            </button>
          ) : (
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setClosing(true)}>
                Chiudi sessione
              </button>
              <button type="button" className="btn" disabled={locked} onClick={() => setPicking(true)}>
                <Icon name="plus" size={17} /> Aggiungi ordine
              </button>
            </>
          )}
        </div>
      </div>

      {payments.data && (
        <BillStrip
          totalCents={totalCents}
          paidCents={parseMoney(payments.data.paid_total)}
          remainingCents={parseMoney(payments.data.remaining)}
          payments={payList}
          coperti={coperti}
          mode={mode}
        />
      )}

      <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
        <ErrorNote error={remove.error ?? confirm.error ?? orders.error ?? payments.error} />
        {hasPayments && !closed && (
          <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>{LOCKED_BY_PAYMENTS}</p>
        )}
      </div>

      <div className="waiter__cols">
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15 }}>Comanda</h3>
            <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }} className="tnum">
              {dishes} {dishes === 1 ? 'piatto' : 'piatti'}
            </span>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {orders.isPending && <p role="status" style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>Caricamento…</p>}
            {orders.data && items.length === 0 && (
              <p style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>
                Nessun piatto. Aggiungi dalla comanda.
              </p>
            )}
            {items.length > 0 && (
              <ul aria-label="Comanda" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {items.map((item, i) => (
                  <li
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '11px 14px',
                      borderTop: i ? '1px solid var(--line)' : 'none',
                    }}
                  >
                    <span className="tnum" style={{ fontWeight: 700, color: 'var(--accent)', minWidth: 26 }}>
                      {item.quantity}×
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14 }}>{item.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                        <Money cents={parseMoney(item.unit_price)} /> cad.
                      </div>
                    </div>
                    <Money cents={parseMoney(item.line_total)} style={{ fontSize: 13.5, color: 'var(--ink-2)' }} />
                    {!closed && (
                      <button
                        type="button"
                        className="waiter__remove"
                        aria-label={`Rimuovi ${item.name}`}
                        disabled={locked || remove.isPending}
                        onClick={() => remove.mutate(item.id)}
                      >
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {orders.data && items.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderTop: '1.5px solid var(--line-2)',
                  background: 'var(--paper-3)',
                  fontWeight: 700,
                }}
              >
                <span>Totale</span>
                <Money cents={parseMoney(orders.data.total)} />
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Pagamenti</h3>
          {payments.data && !hasPayments && (
            <p className="card" style={{ padding: 22, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>
              Ancora nessun pagamento.
            </p>
          )}
          {hasPayments && (
            <ul aria-label="Pagamenti" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {payList.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  busy={confirm.isPending}
                  onConfirm={() => confirm.mutate(payment.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {picking && <MenuPicker sessionId={sessionId} onClose={() => setPicking(false)} />}
      {closing && (
        <CloseDialog
          sessionId={sessionId}
          tableNumber={table.number}
          remainingCents={payments.data ? parseMoney(payments.data.remaining) : null}
          onClose={() => setClosing(false)}
        />
      )}
    </div>
  )
}

type BillProps = {
  totalCents: number
  paidCents: number
  remainingCents: number
  payments: PaymentOut[]
  coperti: number
  mode: 'ROMANA' | 'OWN' | null
}

/** Quanto del conto è coperto. Le cifre le calcola il server: qui si mostrano soltanto. */
function BillStrip({ totalCents, paidCents, remainingCents, payments, coperti, mode }: BillProps) {
  const toConfirm = payments.filter((p) => p.status === 'CASH').length
  return (
    <div
      role="group"
      aria-label="Conto"
      style={{
        padding: '14px 22px',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        marginBottom: 14,
        display: 'grid',
        gap: 10,
      }}
    >
      <Progress value={paidRatio(paidCents, totalCents)} label="Conto pagato" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 22px', fontSize: 13, color: 'var(--ink-2)' }}>
        <div>
          <span style={{ color: 'var(--ink-3)' }}>Totale </span>
          <Money cents={totalCents} style={{ fontWeight: 700 }} />
        </div>
        <div>
          <span style={{ color: 'var(--ink-3)' }}>Pagato </span>
          <Money cents={paidCents} style={{ fontWeight: 700 }} />
        </div>
        <div>
          <span style={{ color: 'var(--ink-3)' }}>Residuo </span>
          <Money cents={remainingCents} style={{ fontWeight: 700 }} />
        </div>
        {mode === 'ROMANA' && (
          <span className="tnum">
            {payments.length} / {coperti} quote
          </span>
        )}
        {toConfirm > 0 && (
          <span className="chip chip--amber" style={{ padding: '2px 9px' }}>
            {toConfirm} {toConfirm === 1 ? 'contante' : 'contanti'} da confermare
          </span>
        )}
      </div>
    </div>
  )
}

function PaymentRow({
  payment,
  busy,
  onConfirm,
}: {
  payment: PaymentOut
  busy: boolean
  onConfirm: () => void
}) {
  const online = payment.method === 'ONLINE'
  return (
    <li className="card pop" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <Initial name={payment.customer_nickname} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{payment.customer_nickname}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name={online ? 'card' : 'cash'} size={12} />
          {online ? 'Online' : 'Alla cassa'}
        </div>
      </div>
      <Money cents={parseMoney(payment.amount)} style={{ fontWeight: 700, fontSize: 14 }} />
      {payment.status === 'COMPLETED' && (
        <span className="chip chip--olive" style={{ fontSize: 11 }}>
          <Icon name="check" size={12} /> Incassato
        </span>
      )}
      {payment.status === 'PENDING' && (
        <span className="chip chip--amber" style={{ fontSize: 11 }}>
          <Icon name="clock" size={12} /> In attesa
        </span>
      )}
      {payment.status === 'CASH' && (
        <button
          type="button"
          className="btn btn--olive"
          style={{ padding: '8px 13px', fontSize: 13 }}
          aria-label={`Conferma contanti di ${payment.customer_nickname}`}
          disabled={busy}
          onClick={onConfirm}
        >
          Conferma
        </button>
      )}
    </li>
  )
}
