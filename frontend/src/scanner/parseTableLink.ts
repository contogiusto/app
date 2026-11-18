/**
 * Il contenuto di un QR (o di un link incollato) è un dato NON fidato: può essere qualsiasi
 * cosa, anche un indirizzo costruito per portare l'utente altrove. Questa funzione è l'unico
 * punto da cui passa: accetta solo il link di un tavolo di QUESTA app e restituisce un percorso
 * interno ricostruito dai pezzi già validati (mai il testo originale).
 */

const MAX_TOKEN_LENGTH = 512
const MAX_ID_DIGITS = 9

// Lo slug di un ristorante: come lo valida il server (3-40 caratteri, minuscole, numeri, trattini).
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Se `text` è un link di un tavolo di questa app dà il percorso da aprire con il router, altrimenti
 * `null`. Forme accettate (e nient'altro): `<origine>/ristorante/<slug>/tavolo/<id>?token=<token>`
 * e il vecchio `<origine>/table/<id>?token=<token>` dei QR già stampati.
 */
export function parseTableLink(text: string, appOrigin: string): string | null {
  let url: URL
  try {
    // Senza base: i percorsi relativi e `//host/...` non sono URL assoluti e vengono rifiutati.
    url = new URL(text.trim())
  } catch {
    return null
  }
  // Stessa origine (schema + host + porta). Con `javascript:`, `data:` ecc. l'origine è "null".
  if (url.origin !== appOrigin || appOrigin === 'null') return null
  if (url.username !== '' || url.password !== '') return null

  const scoped = /^\/ristorante\/([a-z0-9-]+)\/tavolo\/([0-9]+)$/.exec(url.pathname)
  const legacy = /^\/table\/([0-9]+)$/.exec(url.pathname)
  const slug = scoped ? scoped[1] : null
  const id = scoped ? scoped[2] : legacy ? legacy[1] : null
  if (id === null || id.length > MAX_ID_DIGITS) return null
  if (slug !== null && !(slug.length >= 3 && slug.length <= 40 && SLUG.test(slug))) return null
  const tableId = Number(id)
  if (tableId < 1) return null

  const token = url.searchParams.get('token')
  if (!token || token.trim() === '' || token.length > MAX_TOKEN_LENGTH) return null

  const query = `?token=${encodeURIComponent(token)}`
  return slug === null ? `/table/${tableId}${query}` : `/ristorante/${slug}/tavolo/${tableId}${query}`
}
