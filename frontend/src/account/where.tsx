import { useLocation } from 'react-router-dom'

/** Mostra dove si è arrivati: per verificare i ritorni (percorso e query intera). */
export function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
}
