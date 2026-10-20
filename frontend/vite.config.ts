/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In sviluppo le chiamate /api/* vengono girate al backend FastAPI locale (porta 8000, oppure
// quella indicata da API_PROXY: serve a far girare più copie del progetto in parallelo).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': process.env.API_PROXY ?? 'http://localhost:8000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
