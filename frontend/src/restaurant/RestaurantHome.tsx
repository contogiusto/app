import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ApiError, api } from '../api/client'
import { CenterMessage } from '../ui/layout'
import { Icon } from '../ui/Icon'
import { Logo } from '../ui/Logo'

/** `/ristorante/<slug>`: la pagina pubblica del locale. I clienti arrivano dal QR del tavolo. */
export default function RestaurantHome() {
  const { slug = '' } = useParams()
  const restaurant = useQuery({
    queryKey: ['restaurant', slug],
    queryFn: () => api.restaurant(slug),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  })

  if (restaurant.isPending) return <CenterMessage icon="clock" title="Caricamento…" role="status" />
  if (restaurant.isError) {
    const missing = restaurant.error instanceof ApiError && restaurant.error.status === 404
    return (
      <CenterMessage
        icon="pin"
        role="alert"
        title={missing ? 'Ristorante non trovato' : 'Qualcosa non va'}
        body={
          missing
            ? 'Il link non è corretto o il locale non è al momento disponibile.'
            : 'Riprova tra poco.'
        }
      />
    )
  }

  return (
    <div className="app-bg" style={{ height: '100%', overflow: 'auto' }}>
      <main style={{ maxWidth: 420, margin: '0 auto', padding: '56px 22px 32px' }} className="stagger">
        <Logo size={44} />
        <span className="eyebrow" style={{ display: 'block', marginTop: 22 }}>
          Benvenuto da
        </span>
        <h1 className="display" style={{ fontSize: 34, lineHeight: 1.15, margin: '10px 0 12px', overflowWrap: 'anywhere' }}>
          {restaurant.data.name}
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 16, lineHeight: 1.45, marginBottom: 26 }}>
          Per pagare al tavolo inquadra il QR che trovi sul tavolo: puoi farlo anche senza account.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link to="/customer/scan" className="btn btn--lg btn--block" style={{ textDecoration: 'none' }}>
            <Icon name="qr" size={18} /> Inquadra il QR del tavolo
          </Link>
          <Link to="/" className="btn btn--ghost btn--block" style={{ textDecoration: 'none' }}>
            Il mio account
          </Link>
        </div>
        <p style={{ marginTop: 30, fontSize: 14, color: 'var(--text-2)' }}>
          Lavori in questo locale?{' '}
          <Link to={`/ristorante/${slug}/accesso`} style={{ fontWeight: 700 }}>
            Accesso staff
          </Link>
        </p>
      </main>
    </div>
  )
}
