import type { PaymentIn, PublicSession } from '../api/client'
import { parseMoney } from '../lib/money'

type OrderItem = PublicSession['items'][number]

/** Quantità scelte dal cliente nel "proprio conto": id della voce → quantità. */
export type Selection = Record<number, number>

/** Quante unità di una voce non sono ancora coperte da altri pagamenti. */
export function remaining(item: OrderItem): number {
  return item.quantity - item.paid_quantity
}

/** Totale in centesimi delle voci scelte, mai oltre ciò che è ancora libero. */
export function ownTotalCents(items: OrderItem[], selection: Selection): number {
  return items.reduce((sum, item) => {
    const wanted = Math.min(selection[item.id] ?? 0, remaining(item))
    return wanted > 0 ? sum + parseMoney(item.unit_price) * wanted : sum
  }, 0)
}

export function toPaymentItems(selection: Selection): NonNullable<PaymentIn['items']> {
  return Object.entries(selection)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ order_item_id: Number(id), quantity }))
}

/** Avanzamento del pagamento del tavolo, da 0 a 1 (solo per la barra: il server decide la chiusura). */
export function tableProgress(session: PublicSession): number {
  let value = 0
  if (session.payment_mode === 'ROMANA') {
    value = session.payments.length / session.coperti
  } else if (session.payment_mode === 'OWN') {
    const total = parseMoney(session.total)
    value = total > 0 ? parseMoney(session.paid_total) / total : 0
  }
  return Math.min(1, value)
}

export function fullName(first: string, last: string): string {
  return `${first.trim()} ${last.trim()}`.trim()
}
