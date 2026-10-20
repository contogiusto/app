/**
 * Il contenuto di un QR (o di un link incollato) è un dato NON fidato: può essere qualsiasi
 * cosa, anche un indirizzo costruito per portare l'utente altrove. Questa funzione è l'unico
 * punto da cui passa: accetta solo il link di un tavolo di QUESTA app e restituisce un percorso
 * interno ricostruito dai pezzi già validati (mai il testo originale).
 */

const MAX_TOKEN_LENGTH = 512
const MAX_ID_DIGITS = 9

/**
 * Se `text` è un link `<origine dell'app>/table/<id>?token=<token>` dà il percorso da aprire con
 * il router (`/table/<id>?token=<token>`), altrimenti `null`. Niente altro viene mai accettato.
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

  const match = /^\/table\/([0-9]+)$/.exec(url.pathname)
  if (!match || match[1].length > MAX_ID_DIGITS) return null
  const tableId = Number(match[1])
  if (tableId < 1) return null

  const token = url.searchParams.get('token')
  if (!token || token.trim() === '' || token.length > MAX_TOKEN_LENGTH) return null

  return `/table/${tableId}?token=${encodeURIComponent(token)}`
}
