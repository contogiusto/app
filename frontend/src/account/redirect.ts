/** Dove tornare dopo il login se non c'è un indirizzo valido. */
export const DEFAULT_AFTER_LOGIN = '/customer/home'

/**
 * Indirizzo di ritorno ricevuto dall'URL (`?redirect=`), reso sicuro: solo percorsi interni
 * all'app. Qualsiasi altra cosa (un sito esterno, `//altro.sito`, `javascript:`) è un tentativo di
 * "open redirect" e si ignora.
 */
export function safeRedirect(value: string | null | undefined): string {
  if (!value) return DEFAULT_AFTER_LOGIN
  // Deve cominciare con una sola barra: `//host` e `/\host` sono indirizzi esterni per il browser.
  const interno = value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
  // Niente caratteri di controllo (a capo, tabulazioni): il browser li ignora e cambierebbero meta.
  const conControlli = [...value].some((carattere) => carattere.charCodeAt(0) < 32)
  return interno && !conControlli ? value : DEFAULT_AFTER_LOGIN
}

/** Indirizzo della home di login con ritorno a `to` (es. il tavolo da cui si è partiti). */
export function loginUrl(to: string, mode: 'login' | 'register' = 'login'): string {
  const params = new URLSearchParams({ redirect: to })
  if (mode === 'register') params.set('mode', 'register')
  return `/?${params.toString()}`
}
