import { describe, expect, it } from 'vitest'
import { DEFAULT_AFTER_LOGIN, loginUrl, safeRedirect } from './redirect'

describe('safeRedirect', () => {
  it.each([
    ['/customer/history', '/customer/history'],
    ['/table/5?token=abc', '/table/5?token=abc'],
    ['/', '/'],
  ])('accetta il percorso interno %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected)
  })

  it.each([
    ['https://sito-esterno.example', 'sito esterno'],
    ['//sito-esterno.example', 'indirizzo senza protocollo'],
    ['/\\sito-esterno.example', 'barra rovesciata'],
    ['javascript:alert(1)', 'javascript:'],
    ['customer/home', 'percorso relativo'],
    ['/customer\n/home', 'a capo'],
    ['/customer\t/home', 'tabulazione'],
    ['', 'vuoto'],
  ])('rifiuta %j (%s) e usa il valore predefinito', (input) => {
    expect(safeRedirect(input)).toBe(DEFAULT_AFTER_LOGIN)
  })

  it('senza valore usa quello predefinito', () => {
    expect(safeRedirect(null)).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeRedirect(undefined)).toBe(DEFAULT_AFTER_LOGIN)
  })
})

describe('loginUrl', () => {
  it('codifica il ritorno, anche se contiene ? e &', () => {
    const url = loginUrl('/table/5?token=a&b=c')
    expect(url).toBe('/?redirect=%2Ftable%2F5%3Ftoken%3Da%26b%3Dc')
    const params = new URLSearchParams(url.split('?')[1])
    expect(safeRedirect(params.get('redirect'))).toBe('/table/5?token=a&b=c')
  })

  it('può aprire direttamente la registrazione', () => {
    expect(new URLSearchParams(loginUrl('/x', 'register').split('?')[1]).get('mode')).toBe(
      'register',
    )
  })
})
