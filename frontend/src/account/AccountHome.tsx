import { Link } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAccount } from './account'
import { ErrorNote } from './parts'
import { PaymentCard } from './payments'
import { usePayments } from './queries'

const RECENT = 3

/** /customer/home: benvenuto, scorciatoia allo scanner del QR e ultimi pagamenti. */
export default function AccountHome() {
  const { session } = useAccount()
  const payments = usePayments()
  const recent = payments.data?.slice(0, RECENT) ?? []
  return (
    <div className="stagger">
      <span className="eyebrow">Il tuo account</span>
      <h1 className="serif" style={{ fontSize: 40, lineHeight: 1, margin: '8px 0 20px' }}>
        Ciao, {session?.customer.first_name}.
      </h1>

      <Link
        to="/customer/scan"
        className="btn btn--block btn--lg"
        style={{ color: '#fff', textDecoration: 'none', padding: '22px 24px', fontSize: 18 }}
      >
        <Icon name="qr" size={24} /> Scansiona il QR del tavolo
      </Link>
      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '10px 4px 0' }}>
        Con l’account i pagamenti che fai al tavolo finiscono nel tuo storico.
      </p>

      <section aria-labelledby="recent" style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h2 id="recent" className="serif" style={{ fontSize: 26 }}>
            Ultimi pagamenti
          </h2>
          {recent.length > 0 && <Link to="/customer/history">Vedi tutto</Link>}
        </div>
        {payments.isPending && <p role="status" style={{ color: 'var(--ink-2)' }}>Caricamento…</p>}
        {payments.isError && (
          <>
            <ErrorNote>{payments.error.message}</ErrorNote>
            <button type="button" className="btn btn--ghost" style={{ marginTop: 12 }} onClick={() => payments.refetch()}>
              Riprova
            </button>
          </>
        )}
        {payments.isSuccess && recent.length === 0 && (
          <p style={{ color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Non hai ancora pagamenti. Inquadra il QR del tavolo per iniziare: lo storico comparirà qui.
          </p>
        )}
        {recent.length > 0 && (
          <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recent.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
