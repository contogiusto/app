export const PASSWORD_RESET_DONE_NOTICE = 'Password cambiata: ora puoi accedere.'
/** Il token è nel frammento dell'indirizzo (`#token=…`): il browser non lo manda al server. */
export function tokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token')
  return token && token.length <= 200 ? token : null
}
