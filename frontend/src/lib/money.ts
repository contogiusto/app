/** L'API manda gli importi come stringhe decimali ("8.50"): qui si lavora in centesimi interi. */

const DECIMAL = /^(-?)(\d+)(?:\.(\d{1,2}))?$/

export function parseMoney(value: string): number {
  const match = DECIMAL.exec(value.trim())
  if (!match) throw new Error(`Importo non valido: "${value}"`)
  const [, sign, euros, cents = ''] = match
  const total = Number(euros) * 100 + Number(cents.padEnd(2, '0'))
  return sign ? -total : total
}

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

export function formatMoney(cents: number): string {
  return eur.format(cents / 100)
}
