import { parseMoney } from '../lib/money'

/** Massimo accettato dall'API: 8 cifre in tutto, due decimali (999999.99). */
const MAX_CENTS = 99_999_999

/**
 * Legge il prezzo digitato (virgola o punto) e lo dà in centesimi interi.
 * `null` se è vuoto, ha più di due decimali, è negativo o supera il limite dell'API.
 */
export function parsePriceInput(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const cents = parseMoney(normalized)
  return cents > MAX_CENTS ? null : cents
}

/** Centesimi → stringa decimale per l'API ("850" → "8.50"). */
export function centsToDecimal(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

/** Prezzo dell'API ("8.50") → testo da mettere nel campo, senza simbolo. */
export function decimalToInput(price: string | number): string {
  return centsToDecimal(parseMoney(String(price)))
}
