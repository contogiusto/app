/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Indirizzo dell'API; vuoto = stesso dominio (produzione e proxy di sviluppo). */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
