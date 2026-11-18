import { Link } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAccount } from './account'
import { ErrorNote } from './parts'
import { PaymentCard } from './payments'
import { formatDateTime, usePayments, useVisitedRestaurants } from './queries'

const RECENT = 3

/** /customer/home: benvenuto, scorciatoia allo scanner del QR e ultimi pagamenti. */
export default function AccountHome() {
  const { session } = useAccount()
  const payments = usePayments()
  const restaurants = useVisitedRestaurants()
  const recent = payments.data?.slice(0, RECENT) ?? []
  return (
    <div className="stagger">
      <span className="eyebrow">Il tuo account</span>
      <h1 className="display" style={{ fontSize: 28, lineHeight: 1.15, margin: '8px 0 20px' }}>
        Ciao, {session?.customer.first_name}.
      </h1>

      <Link
        to="/customer/scan"
        className="btn btn--block btn--lg"
        style={{ color: 'var(--on-accent)', textDecoration: 'none', padding: '22px 24px', fontSize: 18 }}
      >
        <Icon name="qr" size={24} /> Scansiona il QR del tavolo
      </Link>
      <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '10px 4px 0' }}>
        Con l’account i pagamenti che fai al tavolo finiscono nel tuo storico.
      </p>

      {restaurants.isSuccess && restaurants.data.length > 0 && (
        <section aria-labelledby="visited" style={{ marginTop: 32 }}>
          <h2 id="visited" className="display" style={{ fontSize: 20, marginBottom: 12 }}>
            I tuoi ristoranti
          </h2>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {restaurants.data.map((r) => (
              <li key={r.slug}>
                <Link
                  to={`/ristorante/${r.slug}`}
                  className="card pressable"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', color: 'inherit', textDecoration: 'none' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{r.name}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: 13 }}>
                      {r.visits} {r.visits === 1 ? 'visita' : 'visite'} · ultima {formatDateTime(r.last_visit)}
                    </div>
                  </div>
                  <Icon name="arrow" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="recent" style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h2 id="recent" className="display" style={{ fontSize: 20 }}>
            Ultimi pagamenti
          </h2>
          {recent.length > 0 && <Link to="/customer/history">Vedi tutto</Link>}
        </div>
        {payments.isPending && <p role="status" style={{ color: 'var(--text-2)' }}>Caricamento…</p>}
        {payments.isError && (
          <>
            <ErrorNote>{payments.error.message}</ErrorNote>
            <button type="button" className="btn btn--ghost" style={{ marginTop: 12 }} onClick={() => payments.refetch()}>
              Riprova
            </button>
          </>
        )}
        {payments.isSuccess && recent.length === 0 && (
          <p style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>
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
