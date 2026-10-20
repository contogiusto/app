import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError, api, type MenuItemOut } from '../api/client'
import { parseMoney } from '../lib/money'
import { Icon } from '../ui/Icon'
import { CategoryDot, Money } from '../ui/primitives'
import { AdminIcon } from './icons'
import { Modal } from './Modal'
import { ErrorNote, SectionHeader, Toggle } from './parts'
import { centsToDecimal, decimalToInput, parsePriceInput } from './price'

const MENU_KEY = ['admin', 'menu'] as const
/** Categorie del prototipo: vengono per prime e nell'ordine di un menù; le altre in ordine alfabetico. */
const DEFAULT_CATEGORIES = ['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci', 'Bevande']

const messageOf = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Qualcosa è andato storto: riprova'

function groupByCategory(items: MenuItemOut[]): [string, MenuItemOut[]][] {
  const groups = new Map<string, MenuItemOut[]>()
  for (const item of items) groups.set(item.category, [...(groups.get(item.category) ?? []), item])
  const rank = (category: string) => {
    const index = DEFAULT_CATEGORIES.indexOf(category)
    return index === -1 ? DEFAULT_CATEGORIES.length : index
  }
  return [...groups].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'it'))
}

type Dialog = { kind: 'edit'; item: MenuItemOut | null } | { kind: 'delete'; item: MenuItemOut }

export function MenuScreen() {
  const queryClient = useQueryClient()
  const menu = useQuery({ queryKey: MENU_KEY, queryFn: () => api.staff.menu.all() })
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: MENU_KEY })

  const toggle = useMutation({
    mutationFn: (item: MenuItemOut) =>
      api.staff.menu.update(item.id, {
        name: item.name,
        category: item.category,
        price: item.price,
        available: !item.available,
      }),
    onSuccess: refresh,
  })

  if (menu.isPending) return <p role="status">Caricamento del menù…</p>
  if (menu.isError) return <ErrorNote>{messageOf(menu.error)}</ErrorNote>

  const items = menu.data
  const unavailable = items.filter((item) => !item.available).length
  const categories = [...new Set([...DEFAULT_CATEGORIES, ...items.map((item) => item.category)])]

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '10px 16px' }}>
      <SectionHeader
        title="Menù"
        sub={`${items.length} ${items.length === 1 ? 'piatto' : 'piatti'} · ${unavailable} non disponibili`}
        action={
          <button type="button" className="btn" onClick={() => setDialog({ kind: 'edit', item: null })}>
            <Icon name="plus" size={17} /> Nuovo piatto
          </button>
        }
      />

      {toggle.isError && (
        <div style={{ marginBottom: 16 }}>
          <ErrorNote>{messageOf(toggle.error)}</ErrorNote>
        </div>
      )}

      {items.length === 0 && (
        <p style={{ color: 'var(--ink-2)' }}>Il menù è vuoto: aggiungi il primo piatto.</p>
      )}

      {groupByCategory(items).map(([category, list]) => (
        <section key={category} aria-label={category} style={{ marginBottom: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '0 2px 10px' }}>
            <CategoryDot category={category} size={9} />
            <h3 className="eyebrow">{category}</h3>
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>
          <ul className="card" style={{ overflow: 'hidden', listStyle: 'none', margin: 0, padding: 0 }}>
            {list.map((item, index) => (
              <li
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '13px 18px',
                  borderTop: index ? '1px solid var(--line)' : 'none',
                }}
              >
                <div style={{ flex: 1, opacity: item.available ? 1 : 0.55 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{item.name}</div>
                  {!item.available && (
                    <span style={{ fontSize: 11.5, color: 'var(--clay-deep)', fontWeight: 600 }}>
                      Non disponibile
                    </span>
                  )}
                </div>
                <Money
                  cents={parseMoney(String(item.price))}
                  style={{ fontWeight: 700, fontSize: 15, minWidth: 80, textAlign: 'right' }}
                />
                <Toggle
                  on={item.available}
                  label={`Disponibile: ${item.name}`}
                  disabled={toggle.isPending}
                  onChange={() => toggle.mutate(item)}
                />
                <button
                  type="button"
                  className="iconbtn"
                  aria-label={`Modifica ${item.name}`}
                  onClick={() => setDialog({ kind: 'edit', item })}
                >
                  <AdminIcon name="edit" size={16} />
                </button>
                <button
                  type="button"
                  className="iconbtn"
                  style={{ color: 'var(--clay-deep)' }}
                  aria-label={`Elimina ${item.name}`}
                  onClick={() => setDialog({ kind: 'delete', item })}
                >
                  <AdminIcon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {dialog?.kind === 'edit' && (
        <DishForm
          item={dialog.item}
          categories={categories}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            void refresh()
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteDish
          item={dialog.item}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null)
            void refresh()
          }}
        />
      )}
    </div>
  )
}

function DishForm({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item: MenuItemOut | null
  categories: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState(item?.category ?? 'Antipasti')
  const [price, setPrice] = useState(item ? decimalToInput(item.price) : '')
  const [available, setAvailable] = useState(item?.available ?? true)
  const [priceError, setPriceError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (payload: { name: string; category: string; price: string; available: boolean }) =>
      item ? api.staff.menu.update(item.id, payload) : api.staff.menu.create(payload),
    onSuccess: onSaved,
  })

  const canSave = name.trim() !== '' && category.trim() !== '' && price.trim() !== ''

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const cents = parsePriceInput(price)
    if (cents === null) {
      setPriceError('Inserisci un prezzo valido, con al massimo due decimali (es. 8,50)')
      return
    }
    setPriceError(null)
    save.mutate({
      name: name.trim(),
      category: category.trim(),
      price: centsToDecimal(cents),
      available,
    })
  }

  return (
    <Modal title={item ? 'Modifica piatto' : 'Nuovo piatto'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="field-label" htmlFor="dish-name">
              Nome
            </label>
            <input
              id="dish-name"
              className="field"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. Tagliolini al tartufo"
            />
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label" htmlFor="dish-category">
                Categoria
              </label>
              <input
                id="dish-category"
                className="field"
                list="dish-categories"
                value={category}
                maxLength={60}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id="dish-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div style={{ width: 140 }}>
              <label className="field-label" htmlFor="dish-price">
                Prezzo €
              </label>
              <input
                id="dish-price"
                className="field tnum"
                inputMode="decimal"
                value={price}
                aria-invalid={priceError !== null}
                aria-describedby={priceError ? 'dish-price-error' : undefined}
                onChange={(e) => {
                  setPrice(e.target.value)
                  setPriceError(null)
                }}
                placeholder="0.00"
              />
            </div>
          </div>
          {priceError && (
            <p id="dish-price-error" role="alert" style={{ color: 'var(--clay-deep)', fontSize: 13.5 }}>
              {priceError}
            </p>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14.5 }}>
            <Toggle on={available} onChange={setAvailable} label="Disponibile" />
            Disponibile
          </label>
          {save.isError && <ErrorNote>{messageOf(save.error)}</ErrorNote>}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 26, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn" disabled={!canSave || save.isPending}>
            Salva piatto
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DeleteDish({
  item,
  onClose,
  onDone,
}: {
  item: MenuItemOut
  onClose: () => void
  onDone: () => void
}) {
  const remove = useMutation({ mutationFn: () => api.staff.menu.remove(item.id), onSuccess: onDone })
  const hide = useMutation({
    mutationFn: () =>
      api.staff.menu.update(item.id, {
        name: item.name,
        category: item.category,
        price: item.price,
        available: false,
      }),
    onSuccess: onDone,
  })
  const error = remove.error ?? hide.error
  // Un piatto già ordinato non si cancella (i conti passati lo citano): si offre di nasconderlo.
  const alreadyOrdered = remove.error instanceof ApiError && remove.error.status === 409

  return (
    <Modal title="Eliminare il piatto?" role="alertdialog" onClose={onClose}>
      <p style={{ color: 'var(--ink-2)', lineHeight: 1.5 }}>
        «{item.name}» verrà rimosso dal menù. L'operazione non si può annullare.
      </p>
      {error && (
        <div style={{ marginTop: 16 }}>
          <ErrorNote>{messageOf(error)}</ErrorNote>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 26, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Annulla
        </button>
        {alreadyOrdered && item.available && (
          <button type="button" className="btn btn--olive" disabled={hide.isPending} onClick={() => hide.mutate()}>
            Rendi non disponibile
          </button>
        )}
        {!alreadyOrdered && (
          <button
            type="button"
            className="btn"
            style={{ ['--bg' as string]: 'var(--clay-deep)' }}
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Elimina
          </button>
        )}
      </div>
    </Modal>
  )
}
