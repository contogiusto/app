import { describe, expect, it } from 'vitest'
import { formatMoney, parseMoney } from './money'

describe('parseMoney', () => {
  it.each([
    ['8.50', 850],
    ['10.00', 1000],
    ['0.05', 5],
    ['7', 700],
    ['3.3', 330],
    ['-2.25', -225],
    ['1234.99', 123499],
  ])('%s → %i centesimi', (input, expected) => {
    expect(parseMoney(input)).toBe(expected)
  })

  it.each(['', 'abc', '1,50', '1.234', '--1'])('rifiuta "%s"', (input) => {
    expect(() => parseMoney(input)).toThrow('Importo non valido')
  })
})

describe('formatMoney', () => {
  // Intl usa lo spazio non separabile prima del simbolo: si normalizza per il confronto.
  const norm = (s: string) => s.replace(/\s/g, ' ')

  it('formatta in euro all’italiana', () => {
    expect(norm(formatMoney(850))).toBe('8,50 €')
    expect(norm(formatMoney(0))).toBe('0,00 €')
    // In italiano il separatore delle migliaia compare solo da cinque cifre in su.
    expect(norm(formatMoney(123456))).toBe('1234,56 €')
    expect(norm(formatMoney(1234560))).toBe('12.345,60 €')
  })
})
