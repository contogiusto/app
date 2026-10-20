/**
 * Dati del titolare del trattamento mostrati nell'informativa (`/privacy`).
 * NON sono inventati: finché un campo è vuoto la pagina scrive "da indicare".
 * Li compila chi gestisce il servizio, prima di usarlo con clienti veri.
 */
export const PRIVACY_CONFIG = {
  /** Nome o ragione sociale del titolare, es. "Trattoria Rossi S.r.l." */
  controllerName: '',
  /** Indirizzo (sede) del titolare. */
  controllerAddress: '',
  /** Email a cui scrivere per esercitare i diritti sui dati. */
  contactEmail: '',
  /** Data dell'ultimo aggiornamento dell'informativa, es. "1 gennaio 2027". */
  updatedAt: '',
}

export type PrivacyConfig = typeof PRIVACY_CONFIG
