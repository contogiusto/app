// Senza caratteri ambigui (0/O, 1/l/I): la password provvisoria si detta o si copia a mano.
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Password provvisoria casuale (16 caratteri, ≥ 12 come richiede il server). */
export function generatePassword(length = 16): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  // Scarto i valori che sbilancerebbero la scelta (256 non è multiplo della lunghezza).
  const limit = 256 - (256 % ALPHABET.length)
  let out = ''
  for (let i = 0; out.length < length; i++) {
    if (i >= bytes.length) {
      crypto.getRandomValues(bytes)
      i = 0
    }
    if (bytes[i] < limit) out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}
