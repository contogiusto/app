import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type MenuItemOut } from '../api/client'
import { parseMoney } from '../lib/money'
import { Icon } from '../ui/Icon'
import { CategoryDot, Money, Stepper } from '../ui/primitives'
import { groupByCategory } from './logic'
import { ErrorNote, Overlay } from './parts'
import { useMenu, useRefresh } from './queries'

const ALL = 'Tutti'

/** Scheda laterale con il menu: si sceglie la quantità e si aggiunge alla comanda, anche più volte. */
export function MenuPicker({ sessionId, onClose }: { sessionId: number; onClose: () => void }) {
  const menu = useMenu()
  const refresh = useRefresh()
  const [category, setCategory] = useState(ALL)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [added, setAdded] = useState<string | null>(null)

  const add = useMutation({
    mutationFn: ({ item, quantity }: { item: MenuItemOut; quantity: number }) =>
      api.staff.orders.add(sessionId, item.id, quantity),
    onSuccess: (_, { item, quantity }) => {
      setAdded(`${quantity} × ${item.name}`)
      setQuantities((prev) => ({ ...prev, [item.id]: 1 }))
    },
    // Anche su errore si rilegge: un 409 vuol dire che i pagamenti sono partiti e la comanda si blocca.
    onSettled: () => refresh(),
  })

  const groups = groupByCategory(menu.data ?? [])
  const shown = groups.filter((g) => category === ALL || g.category === category)

  return (
    <Overlay label="Aggiungi alla comanda" placement="right" onClose={onClose}>
      <div
        style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 className="serif" style={{ fontSize: 22 }}>
          Aggiungi alla comanda
        </h3>
        <button
          type="button"
          className="iconbtn"
          aria-label="Chiudi"
          data-autofocus
          onClick={onClose}
          style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(34,28,21,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div
        className="scroll"
        style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 7, overflowX: 'auto' }}
      >
        {[ALL, ...groups.map((g) => g.category)].map((name) => {
          const active = category === name
          return (
            <button
              key={name}
              type="button"
              className="chip"
              aria-pressed={active}
              onClick={() => setCategory(name)}
              style={{
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: active ? 'var(--ink)' : 'rgba(34,28,21,.05)',
                color: active ? 'var(--paper-2)' : 'var(--ink-2)',
              }}
            >
              {name}
            </button>
          )
        })}
      </div>

      <div className="scroll" style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
          <ErrorNote error={add.error ?? menu.error} />
          <p role="status" style={{ fontSize: 13, color: 'var(--olive-deep)', fontWeight: 600, minHeight: 0 }}>
            {added ? `Aggiunto: ${added}` : ''}
          </p>
        </div>
        {menu.isPending && <p style={{ padding: 12, color: 'var(--ink-3)' }}>Caricamento del menu…</p>}
        {menu.data && shown.length === 0 && (
          <p style={{ padding: 12, color: 'var(--ink-3)' }}>Nessun piatto disponibile.</p>
        )}
        {shown.flatMap((g) => g.items).map((item) => {
          const quantity = quantities[item.id] ?? 1
          return (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', flexWrap: 'wrap' }}>
              <CategoryDot category={item.category} />
              <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{item.category}</div>
              </div>
              <Money cents={parseMoney(item.price)} style={{ fontSize: 13.5, color: 'var(--ink-2)' }} />
              <Stepper
                value={quantity}
                min={1}
                max={99}
                label={`quantità ${item.name}`}
                onChange={(value) => setQuantities((prev) => ({ ...prev, [item.id]: value }))}
              />
              <button
                type="button"
                className="btn"
                style={{ padding: '8px 14px', fontSize: 13 }}
                aria-label={`Aggiungi alla comanda: ${item.name}`}
                disabled={add.isPending}
                onClick={() => add.mutate({ item, quantity })}
              >
                <Icon name="plus" size={14} stroke={2.4} /> Aggiungi
              </button>
            </div>
          )
        })}
      </div>
    </Overlay>
  )
}
