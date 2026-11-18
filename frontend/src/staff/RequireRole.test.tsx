import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRole } from '../api/client'
import App from '../App'
import { fakeJwt } from './testing'

// Le schermate vere del cameriere hanno i loro test (src/waiter): qui conta solo la rotta.
vi.mock('../waiter/WaiterApp', async () => {
  const { StaffLayout } = await import('../staff/StaffLayout')
  return { default: () => <StaffLayout title="Sala">{null}</StaffLayout> }
})

// Le schermate vere del ristoratore hanno i loro test (src/admin): qui conta solo la rotta.
vi.mock('../admin/AdminApp', async () => {
  const { StaffLayout } = await import('../staff/StaffLayout')
  return { default: () => <StaffLayout title="Gestione">{null}</StaffLayout> }
})

// La schermata vera della piattaforma ha i suoi test (src/platform): qui conta solo la rotta.
vi.mock('../platform/PlatformApp', async () => {
  const { StaffLayout } = await import('../staff/StaffLayout')
  return { default: () => <StaffLayout title="Piattaforma">{null}</StaffLayout> }
})

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

  it('SUPERADMIN entra in /piattaforma e non nelle rotte dei locali', () => {
    signIn('SUPERADMIN')
    const first = renderAt('/piattaforma')
    expect(screen.getByRole('heading', { name: 'Piattaforma' })).toBeInTheDocument()
    first.unmount()
    renderAt('/admin')
    expect(screen.getByRole('heading', { name: 'Piattaforma' })).toBeInTheDocument()
  })

  it('ADMIN e WAITER su /piattaforma vengono riportati alla loro pagina', () => {
    signIn('WAITER')
    const first = renderAt('/piattaforma')
    expect(screen.getByRole('heading', { name: 'Sala' })).toBeInTheDocument()
    first.unmount()
    signIn('ADMIN')
    renderAt('/piattaforma')
    expect(screen.getByRole('heading', { name: 'Gestione' })).toBeInTheDocument()
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
