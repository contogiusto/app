import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { initialsOf } from '../lib/names'
import { Initial, Money, Progress, Stepper } from './primitives'

describe('Money', () => {
  it('mostra l’importo in euro', () => {
    render(<Money cents={1450} />)
    expect(screen.getByText(/14,50/)).toBeInTheDocument()
  })
})

describe('Progress', () => {
  it('espone il valore in percentuale e lo limita tra 0 e 100', () => {
    const { rerender } = render(<Progress value={0.4} label="Pagato" />)
    expect(screen.getByRole('progressbar', { name: 'Pagato' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    )
    rerender(<Progress value={3} label="Pagato" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    rerender(<Progress value={-1} label="Pagato" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})

describe('Initial', () => {
  it.each([
    ['Anna Russo', 'AR'],
    ['anna', 'A'],
    ['  luca   bianchi  ', 'LB'],
    ['', '?'],
  ])('iniziali di "%s" → %s', (name, expected) => {
    expect(initialsOf(name)).toBe(expected)
    if (name) expect(render(<Initial name={name} />).container).toHaveTextContent(expected)
  })
})

describe('Stepper', () => {
  it('aumenta e diminuisce rispettando i limiti', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Stepper value={1} min={0} max={2} onChange={onChange} label="Pizza" />)

    await user.click(screen.getByRole('button', { name: 'Aggiungi Pizza' }))
    expect(onChange).toHaveBeenLastCalledWith(2)
    await user.click(screen.getByRole('button', { name: 'Togli Pizza' }))
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('disabilita i pulsanti ai limiti', () => {
    const { rerender } = render(<Stepper value={0} min={0} max={2} onChange={vi.fn()} label="X" />)
    expect(screen.getByRole('button', { name: 'Togli X' })).toBeDisabled()
    rerender(<Stepper value={2} min={0} max={2} onChange={vi.fn()} label="X" />)
    expect(screen.getByRole('button', { name: 'Aggiungi X' })).toBeDisabled()
  })
})
