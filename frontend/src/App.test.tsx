import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'

it('mostra il titolo', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Conto Giusto' })).toBeTruthy()
})
