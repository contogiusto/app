import { StaffLayout } from '../staff/StaffLayout'

/** Segnaposto: le schermate del cameriere vanno costruite qui dentro (e solo in `src/waiter/`). */
export default function WaiterApp() {
  return (
    <StaffLayout title="Sala">
      <p style={{ color: 'var(--ink-2)' }}>Schermate del cameriere in arrivo.</p>
    </StaffLayout>
  )
}
