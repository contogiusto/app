import { describe, expect, it } from 'vitest'
import type { MenuItemOut } from '../api/client'
import { groupByCategory, modeLabel, paidRatio } from './logic'

const dish = (id: number, category: string, available = true): MenuItemOut => ({
  id,
  name: `Piatto ${id}`,
  category,
  price: '5.00',
  available,
})

describe('groupByCategory', () => {
  it('raggruppa nell’ordine di comparsa e scarta i piatti non disponibili', () => {
    const groups = groupByCategory([
      dish(1, 'Primi'),
      dish(2, 'Dolci'),
      dish(3, 'Primi'),
      dish(4, 'Secondi', false),
    ])
    expect(groups.map((g) => [g.category, g.items.map((i) => i.id)])).toEqual([
      ['Primi', [1, 3]],
      ['Dolci', [2]],
    ])
  })
})

describe('paidRatio', () => {
  it('va da 0 a 1 e con totale zero resta 0', () => {
    expect(paidRatio(2500, 5000)).toBe(0.5)
    expect(paidRatio(9000, 5000)).toBe(1)
    expect(paidRatio(0, 0)).toBe(0)
  })
})

describe('modeLabel', () => {
  it('nomina le modalità e quella ancora da scegliere', () => {
    expect(modeLabel('ROMANA')).toBe('Alla romana')
    expect(modeLabel('OWN')).toBe('Proprio conto')
    expect(modeLabel(null)).toBe('Modalità da scegliere')
  })
})
