import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import type { UserRole } from '../api/client'
import App from '../App'
import { fakeJwt } from './testing'

function signIn(role: UserRole) {
  localStorage.setItem('cg:staff', JSON.stringify({ token: fakeJwt(3600), role, username: 'u' }))
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

beforeEach(() => localStorage.clear())

describe('rotte protette', () => {
  it.each(['/waiter', '/admin', '/admin/qualcosa'])('un anonimo su %s va al login', (path) => {
    renderAt(path)
    expect(screen.getByRole('heading', { name: 'Accedi.' })).toBeInTheDocument()
  })

  it('WAITER entra in /waiter', () => {
    signIn('WAITER')
    renderAt('/waiter')
    expect(screen.getByRole('heading', { name: 'Sala' })).toBeInTheDocument()
  })

  it('WAITER su /admin viene riportato a /waiter', () => {
    signIn('WAITER')
    renderAt('/admin')
    expect(screen.getByRole('heading', { name: 'Sala' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Gestione' })).toBeNull()
  })

  it('ADMIN entra sia in /admin sia in /waiter', () => {
    signIn('ADMIN')
    const first = renderAt('/admin')
    expect(screen.getByRole('heading', { name: 'Gestione' })).toBeInTheDocument()
    first.unmount()
    renderAt('/waiter')
    expect(screen.getByRole('heading', { name: 'Sala' })).toBeInTheDocument()
  })

  it('con un token scaduto si torna al login', () => {
    localStorage.setItem(
      'cg:staff',
      JSON.stringify({ token: fakeJwt(-60), role: 'ADMIN', username: 'u' }),
    )
    renderAt('/admin')
    expect(screen.getByRole('heading', { name: 'Accedi.' })).toBeInTheDocument()
  })
})
