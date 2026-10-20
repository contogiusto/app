import { describe, expect, it } from 'vitest'
import { centsToDecimal, decimalToInput, parsePriceInput } from './price'

describe('parsePriceInput', () => {
  it.each([
    ['8.50', 850],
    ['8,5', 850],
    ['12', 1200],
    [' 0,99 ', 99],
    ['0', 0],
    ['999999.99', 99_999_999],
  ])('accetta "%s"', (text, cents) => expect(parsePriceInput(text)).toBe(cents))

  it.each(['', 'abc', '-3', '8.505', '8,', '.5', '1.000.00', '1000000'])('rifiuta "%s"', (text) =>
    expect(parsePriceInput(text)).toBeNull(),
  )
})

describe('conversioni', () => {
  it('centesimi → decimale', () => {
    expect(centsToDecimal(850)).toBe('8.50')
    expect(centsToDecimal(5)).toBe('0.05')
    expect(centsToDecimal(1200)).toBe('12.00')
  })
  it('prezzo API → campo', () => {
    expect(decimalToInput('8.5')).toBe('8.50')
    expect(decimalToInput(12)).toBe('12.00')
  })
})
