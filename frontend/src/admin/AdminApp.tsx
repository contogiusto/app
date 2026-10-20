import { StaffLayout } from '../staff/StaffLayout'

/** Segnaposto: le schermate del ristoratore vanno costruite qui dentro (e solo in `src/admin/`). */
export default function AdminApp() {
  return (
    <StaffLayout title="Gestione">
      <p style={{ color: 'var(--ink-2)' }}>Schermate del ristoratore in arrivo.</p>
    </StaffLayout>
  )
}
