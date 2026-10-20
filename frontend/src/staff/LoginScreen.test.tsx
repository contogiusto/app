import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, type UserRole } from '../api/client'
import App from '../App'
import { fakeJwt } from './testing'

// Le schermate vere del cameriere hanno i loro test (src/waiter): qui conta solo la rotta.
vi.mock('../waiter/WaiterApp', async () => {
  const { StaffLayout } = await import('../staff/StaffLayout')
  return { default: () => <StaffLayout title="Sala">{null}</StaffLayout> }
})

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

const loginAs = (role: UserRole) =>
  vi.spyOn(api, 'login').mockResolvedValue({
    access_token: fakeJwt(3600),
    token_type: 'bearer',
    role,
  })

async function fill(user: ReturnType<typeof userEvent.setup>, name = 'anna', password = 'pw') {
  await user.type(screen.getByLabelText('Utente'), name)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: /Entra/ }))
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('LoginScreen', () => {
  it('WAITER dopo il login va in /waiter', async () => {
    const user = userEvent.setup()
    loginAs('WAITER')
    renderAt('/staff/login')
    await fill(user)
    expect(await screen.findByRole('heading', { name: 'Sala' })).toBeInTheDocument()
    expect(api.login).toHaveBeenCalledWith('anna', 'pw')
  })

  it('ADMIN dopo il login va in /admin', async () => {
    const user = userEvent.setup()
    loginAs('ADMIN')
    renderAt('/staff/login')
    await fill(user, 'mario')
    expect(await screen.findByRole('heading', { name: 'Gestione' })).toBeInTheDocument()
  })

  it('torna alla pagina richiesta prima del login, se il ruolo può entrarci', async () => {
    const user = userEvent.setup()
    loginAs('ADMIN')
    renderAt('/waiter') // anonimo → login, con ritorno a /waiter
    await fill(user, 'mario')
    expect(await screen.findByRole('heading', { name: 'Sala' })).toBeInTheDocument()
  })

  it('il ritorno a /admin non vale per un WAITER: va alla sua pagina', async () => {
    const user = userEvent.setup()
    loginAs('WAITER')
    renderAt('/admin')
    await fill(user)
    expect(await screen.findByRole('heading', { name: 'Sala' })).toBeInTheDocument()
  })

  it('credenziali errate: mostra il messaggio dell’API e resta sul login', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'login').mockRejectedValue(new ApiError(401, 'Credenziali non valide'))
    renderAt('/staff/login')
    await fill(user, 'anna', 'sbagliata')
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenziali non valide')
    expect(screen.getByRole('heading', { name: 'Accedi.' })).toBeInTheDocument()
    // si può riprovare subito
    await waitFor(() => expect(screen.getByRole('button', { name: /Entra/ })).toBeEnabled())
  })

  it('senza rete mostra il messaggio di connessione', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'login').mockRejectedValue(new ApiError(0, 'Connessione assente: riprova tra poco'))
    renderAt('/staff/login')
    await fill(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('Connessione assente')
  })

  it('utente e password sono obbligatori: senza, non si chiama l’API', async () => {
    const user = userEvent.setup()
    const spy = loginAs('WAITER')
    renderAt('/staff/login')
    expect(screen.getByLabelText('Utente')).toBeRequired()
    expect(screen.getByLabelText('Password')).toBeRequired()
    await user.click(screen.getByRole('button', { name: /Entra/ }))
    expect(spy).not.toHaveBeenCalled()
  })

  it('già collegato: salta il form e va alla pagina del ruolo', () => {
    localStorage.setItem(
      'cg:staff',
      JSON.stringify({ token: fakeJwt(3600), role: 'ADMIN', username: 'mario' }),
    )
    renderAt('/staff/login')
    expect(screen.getByRole('heading', { name: 'Gestione' })).toBeInTheDocument()
  })

  it('il pulsante Esci riporta al login', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      'cg:staff',
      JSON.stringify({ token: fakeJwt(3600), role: 'WAITER', username: 'anna' }),
    )
    renderAt('/waiter')
    expect(screen.getByText('anna')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Esci/ }))
    expect(await screen.findByRole('heading', { name: 'Accedi.' })).toBeInTheDocument()
    expect(localStorage.getItem('cg:staff')).toBeNull()
  })
})
