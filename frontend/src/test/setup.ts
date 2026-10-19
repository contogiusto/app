import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest non espone `afterEach` globale, quindi la pulizia automatica di Testing Library
// non scatta da sola: senza questa i componenti restano montati tra un test e l'altro.
afterEach(() => cleanup())
