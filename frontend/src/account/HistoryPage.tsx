import { Link } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { ErrorNote } from './parts'
import { PaymentCard } from './payments'
import { usePayments } from './queries'

/** /customer/history: tutti i pagamenti legati all'account, dal più recente. */
export default function HistoryPage() {
  const payments = usePayments()
  return (
    <div>
      <h1 className="serif" style={{ fontSize: 40, lineHeight: 1, marginBottom: 6 }}>
        Storico
      </h1>
      <p style={{ color: 'var(--ink-2)', fontSize: 14.5, marginBottom: 20 }}>
        I pagamenti fatti al tavolo mentre eri collegato.
      </p>

      {payments.isPending && <p role="status" style={{ color: 'var(--ink-2)' }}>Caricamento…</p>}

      {payments.isError && (
        <>
          <ErrorNote>{payments.error.message}</ErrorNote>
          <button type="button" className="btn btn--ghost" style={{ marginTop: 12 }} onClick={() => payments.refetch()}>
            Riprova
          </button>
        </>
      )}

      {payments.isSuccess && payments.data.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <Icon name="receipt" size={30} style={{ color: 'var(--ink-3)' }} />
          <p style={{ margin: '10px 0 16px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Nessun pagamento, per ora. Scansiona il QR di un tavolo: i prossimi pagamenti
            compariranno qui.
          </p>
          <Link to="/customer/scan" className="btn" style={{ color: '#fff', textDecoration: 'none' }}>
            <Icon name="qr" size={18} /> Scansiona il QR
          </Link>
        </div>
      )}

      {payments.isSuccess && payments.data.length > 0 && (
        <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {payments.data.map((payment) => (
            <PaymentCard key={payment.id} payment={payment} />
          ))}
        </ul>
      )}
    </div>
  )
}
