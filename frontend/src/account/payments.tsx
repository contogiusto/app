import type { CustomerPayment } from '../api/client'
import { formatMoney, parseMoney } from '../lib/money'
import { Icon } from '../ui/Icon'
import { Money } from '../ui/primitives'
import { formatDateTime } from './queries'

const METHOD = { ONLINE: 'Online', CASH: 'Contanti' } as const

/** Stato come chip: COMPLETED = pagato, CASH = alla cassa in attesa che il cameriere confermi. */
export function StatusChip({ status }: { status: CustomerPayment['status'] }) {
  if (status === 'COMPLETED') {
    return (
      <span className="chip chip--olive">
        <Icon name="check" size={13} stroke={2.4} /> Pagato
      </span>
    )
  }
  if (status === 'CASH') {
    return (
      <span className="chip chip--amber">
        <Icon name="clock" size={13} /> Alla cassa, in attesa di conferma
      </span>
    )
  }
  return <span className="chip">In attesa</span>
}

/** Con OWN gli `items` sono i piatti pagati dal cliente; con ROMANA sono tutti i piatti del tavolo. */
const itemsLabel = (mode: CustomerPayment['mode']) =>
  mode === 'OWN' ? 'Piatti pagati' : 'Piatti del tavolo (la tua è una quota)'

export function PaymentCard({ payment }: { payment: CustomerPayment }) {
  const { items } = payment
  return (
    <li className="card" style={{ listStyle: 'none', padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{payment.restaurant_name}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3 }}>
            <time dateTime={payment.created_at}>{formatDateTime(payment.created_at)}</time> · Tavolo{' '}
            {payment.table_number} · {METHOD[payment.method]}
          </div>
        </div>
        <Money cents={parseMoney(payment.amount)} style={{ fontWeight: 800, fontSize: 18 }} />
      </div>
      <div style={{ marginTop: 10 }}>
        <StatusChip status={payment.status} />
      </div>
      {items.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>
            {itemsLabel(payment.mode)}
          </summary>
          <ul style={{ margin: '8px 0 0', padding: 0 }}>
            {items.map((item, index) => (
              <li
                key={index}
                style={{
                  listStyle: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '5px 0',
                  fontSize: 14,
                }}
              >
                <span>
                  {item.quantity}× {item.name}
                </span>
                <Money cents={parseMoney(item.unit_price) * item.quantity} />
              </li>
            ))}
          </ul>
          {payment.mode === 'ROMANA' && (
            <p style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 6 }}>
              Hai pagato {formatMoney(parseMoney(payment.amount))}, una parte del totale del tavolo.
            </p>
          )}
        </details>
      )}
    </li>
  )
}
