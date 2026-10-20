import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type StaffTable } from '../api/client'
import { Icon } from '../ui/Icon'
import { Stepper } from '../ui/primitives'
import { ErrorNote } from './parts'
import { useRefresh } from './queries'

/** Tavolo libero: quanti coperti? Serve per dividere il conto alla romana. */
export function OpenSessionPane({ table }: { table: StaffTable }) {
  const [coperti, setCoperti] = useState(2)
  const refresh = useRefresh()
  const open = useMutation({
    mutationFn: () => api.staff.sessions.open(table.id, coperti),
    // Anche su 409 si rilegge: se un collega ha già aperto il tavolo, qui compare la sua sessione.
    onSettled: () => refresh(),
  })

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
      <div className="card pop" style={{ padding: 36, maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'var(--accent-tint)',
            color: 'var(--accent-deep)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
          }}
        >
          <Icon name="table" size={30} />
        </div>
        <span className="eyebrow">Tavolo {table.number} · Libero</span>
        <h2 className="serif" style={{ fontSize: 30, margin: '6px 0 8px' }}>
          Apri una sessione
        </h2>
        <p style={{ color: 'var(--ink-2)', fontSize: 14.5, marginBottom: 26 }}>
          Quanti coperti a questo tavolo? Serve per dividere il conto alla romana.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 28 }}>
          <span style={{ fontSize: 14, color: 'var(--ink-3)', fontWeight: 600 }}>Coperti</span>
          <Stepper value={coperti} min={1} max={100} label="coperti" onChange={setCoperti} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <ErrorNote error={open.error} />
        </div>
        <button
          type="button"
          className="btn btn--block btn--lg"
          disabled={open.isPending}
          onClick={() => open.mutate()}
        >
          <Icon name="plus" size={18} /> Apri sessione · {coperti} coperti
        </button>
      </div>
    </div>
  )
}
