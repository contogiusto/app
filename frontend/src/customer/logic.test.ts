import { describe, expect, it } from 'vitest'
import type { PublicSession } from '../api/client'
import { fullName, ownTotalCents, remaining, tableProgress, toPaymentItems } from './logic'

type Item = PublicSession['items'][number]

const item = (over: Partial<Item> = {}): Item => ({
  id: 1,
  name: 'Pizza',
  category: 'Pizze',
  quantity: 2,
  unit_price: '8.50',
  line_total: '17.00',
  paid_quantity: 0,
  ...over,
})

const session = (over: Partial<PublicSession> = {}): PublicSession => ({
  id: 1,
  status: 'OPEN',
  coperti: 4,
  payment_mode: 'ROMANA',
  total: '40.00',
  paid_total: '0.00',
  remaining: '40.00',
  next_share: '10.00',
  items: [],
  payments: [],
  ...over,
})

describe('remaining', () => {
  it('è la quantità non ancora coperta da altri', () => {
    expect(remaining(item({ quantity: 3, paid_quantity: 1 }))).toBe(2)
    expect(remaining(item({ quantity: 1, paid_quantity: 1 }))).toBe(0)
  })
})

describe('ownTotalCents', () => {
  it('somma quantità × prezzo delle voci scelte', () => {
    const items = [item({ id: 1, unit_price: '8.50' }), item({ id: 2, unit_price: '3.00' })]
    expect(ownTotalCents(items, { 1: 1, 2: 2 })).toBe(850 + 600)
  })

  it('ignora quantità zero, voci sconosciute e non supera il residuo', () => {
    const items = [item({ id: 1, quantity: 2, paid_quantity: 1, unit_price: '10.00' })]
    expect(ownTotalCents(items, { 1: 0 })).toBe(0)
    expect(ownTotalCents(items, { 99: 3 })).toBe(0)
    expect(ownTotalCents(items, { 1: 5 })).toBe(1000)
  })
})

describe('toPaymentItems', () => {
  it('invia solo le voci con quantità positiva', () => {
    expect(toPaymentItems({ 1: 2, 2: 0, 3: 1 })).toEqual([
      { order_item_id: 1, quantity: 2 },
      { order_item_id: 3, quantity: 1 },
    ])
  })
})

describe('tableProgress', () => {
  it('alla romana conta le quote sui coperti', () => {
    const payments = [
      { customer_nickname: 'A', amount: '10.00', method: 'ONLINE', status: 'COMPLETED' },
      { customer_nickname: 'B', amount: '10.00', method: 'CASH', status: 'CASH' },
    ] as PublicSession['payments']
    expect(tableProgress(session({ coperti: 4, payments }))).toBe(0.5)
  })

  it('con il proprio conto conta gli euro sul totale', () => {
    const s = session({ payment_mode: 'OWN', total: '40.00', paid_total: '10.00' })
    expect(tableProgress(s)).toBe(0.25)
  })

  it('è zero senza modalità o senza ordini', () => {
    expect(tableProgress(session({ payment_mode: null }))).toBe(0)
    expect(tableProgress(session({ payment_mode: 'OWN', total: '0.00', paid_total: '0.00' }))).toBe(0)
  })

  it('non supera mai 1', () => {
    const s = session({ payment_mode: 'OWN', total: '10.00', paid_total: '12.00' })
    expect(tableProgress(s)).toBe(1)
  })
})

describe('fullName', () => {
  it('unisce nome e cognome senza spazi in eccesso', () => {
    expect(fullName('  Anna ', ' Russo  ')).toBe('Anna Russo')
    expect(fullName('Anna', '')).toBe('Anna')
  })
})
