import type { MenuItemOut, PaymentMode } from '../api/client'

export type MenuGroup = { category: string; items: MenuItemOut[] }

/** Piatti disponibili raggruppati per categoria, nell'ordine in cui il menu le presenta. */
export function groupByCategory(menu: MenuItemOut[]): MenuGroup[] {
  const groups = new Map<string, MenuItemOut[]>()
  for (const item of menu) {
    if (!item.available) continue
    groups.set(item.category, [...(groups.get(item.category) ?? []), item])
  }
  return [...groups].map(([category, items]) => ({ category, items }))
}

/** Quanto del conto è già coperto, da 0 a 1 (solo per le barre: la chiusura la decide il server). */
export function paidRatio(paidCents: number, totalCents: number): number {
  return totalCents > 0 ? Math.min(1, paidCents / totalCents) : 0
}

export function modeLabel(mode: PaymentMode | null): string {
  if (mode === 'ROMANA') return 'Alla romana'
  if (mode === 'OWN') return 'Proprio conto'
  return 'Modalità da scegliere'
}
