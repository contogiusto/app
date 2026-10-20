import { describe, expect, it } from 'vitest'
import { parseTableLink } from './parseTableLink'

const ORIGIN = 'https://app.example.com'
const parse = (text: string) => parseTableLink(text, ORIGIN)

describe('link validi', () => {
  it('accetta il link del tavolo e dà il percorso interno', () => {
    expect(parse('https://app.example.com/table/12?token=abc123')).toBe('/table/12?token=abc123')
  })

  it('tollera spazi attorno (link incollato)', () => {
    expect(parse('  https://app.example.com/table/3?token=x\n')).toBe('/table/3?token=x')
  })

  it('tiene solo il token: scarta altri parametri e il frammento', () => {
    expect(parse('https://app.example.com/table/3?foo=1&token=x&bar=2#frag')).toBe(
      '/table/3?token=x',
    )
  })

  it('ricodifica il token (nessun carattere speciale passa nel percorso)', () => {
    expect(parse('https://app.example.com/table/3?token=a%26b%23c')).toBe(
      '/table/3?token=a%26b%23c',
    )
    expect(parse('https://app.example.com/table/3?token=a%2Fb')).toBe('/table/3?token=a%2Fb')
  })

  it('normalizza gli zeri iniziali dell’id', () => {
    expect(parse('https://app.example.com/table/007?token=x')).toBe('/table/7?token=x')
  })

  it('funziona anche con porta e http in sviluppo', () => {
    expect(parseTableLink('http://localhost:5173/table/1?token=t', 'http://localhost:5173')).toBe(
      '/table/1?token=t',
    )
  })
})

describe('link rifiutati', () => {
  it.each([
    ['altro dominio', 'https://app.example.evil/table/1?token=x'],
    ['sottodominio', 'https://evil.app.example.com/table/1?token=x'],
    ['dominio con la nostra origine come prefisso', 'https://app.example.com.evil.io/table/1?token=x'],
    ['credenziali che mascherano l’host', 'https://app.example.com@evil.io/table/1?token=x'],
    ['credenziali nell’URL', 'https://user:pw@app.example.com/table/1?token=x'],
    ['schema diverso', 'http://app.example.com/table/1?token=x'],
    ['porta diversa', 'https://app.example.com:8443/table/1?token=x'],
    ['protocol-relative', '//evil/table/1?token=x'],
    ['percorso relativo', '/table/1?token=x'],
    ['senza schema', 'app.example.com/table/1?token=x'],
    ['javascript:', 'javascript:alert(1)'],
    ['javascript: con il percorso giusto', 'javascript://app.example.com/table/1?token=x%0Aalert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['blob:', 'blob:https://app.example.com/table/1?token=x'],
    ['percorso con ..', 'https://app.example.com/table/1/../../x?token=x'],
    ['percorso diverso', 'https://app.example.com/admin?token=x'],
    ['staff', 'https://app.example.com/staff/login'],
    ['percorso più lungo', 'https://app.example.com/table/1/extra?token=x'],
    ['barra finale', 'https://app.example.com/table/1/?token=x'],
    ['prefisso nel percorso', 'https://app.example.com/x/table/1?token=x'],
    ['id non numerico', 'https://app.example.com/table/abc?token=x'],
    ['id misto', 'https://app.example.com/table/1a?token=x'],
    ['id negativo', 'https://app.example.com/table/-1?token=x'],
    ['id zero', 'https://app.example.com/table/0?token=x'],
    ['id decimale', 'https://app.example.com/table/1.5?token=x'],
    ['id enorme', 'https://app.example.com/table/12345678901234567890?token=x'],
    ['id vuoto', 'https://app.example.com/table/?token=x'],
    ['cifre non ASCII', 'https://app.example.com/table/١٢?token=x'],
    ['token assente', 'https://app.example.com/table/1'],
    ['token vuoto', 'https://app.example.com/table/1?token='],
    ['token di soli spazi', 'https://app.example.com/table/1?token=%20%20'],
    ['token con altro nome', 'https://app.example.com/table/1?tok=x'],
    ['token troppo lungo', `https://app.example.com/table/1?token=${'a'.repeat(600)}`],
    ['testo qualsiasi', 'ciao a tutti'],
    ['stringa vuota', ''],
    ['solo spazi', '   '],
  ])('%s', (_name, text) => {
    expect(parse(text)).toBeNull()
  })

  it('non accetta nulla se l’origine dell’app è "null"', () => {
    expect(parseTableLink('javascript:alert(1)', 'null')).toBeNull()
  })
})
