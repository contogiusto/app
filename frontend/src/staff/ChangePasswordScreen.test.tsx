import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '../api/client'
import App from '../App'
import { fakeJwt } from './testing'

// Le schermate vere hanno i loro test: qui conta solo dove si arriva.
vi.mock('../waiter/WaiterApp', async () => {
  const { StaffLayout } = await import('../staff/StaffLayout')
  return { default: () => <StaffLayout title="Sala">{null}</StaffLayout> }
})
vi.mock('../admin/AdminApp', async () => {
  const { StaffLayout } = await import('../staff/StaffLayout')
  return { default: () => <StaffLayout title="Gestione">{null}</StaffLayout> }
})

const NEW_TOKEN = {
  access_token: fakeJwt(3600),
  token_type: 'bearer',
  role: 'WAITER' as const,
  must_change_password: false,
  restaurant_slug: 'da-gino',
}

function signIn(extra: object = {}) {
  localStorage.setItem(
    'cg:staff',
    JSON.stringify({ token: fakeJwt(3600), role: 'WAITER', username: 'anna', restaurant: 'da-gino', ...extra }),
  )
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('password provvisoria', () => {
  it('chi deve cambiare la password viene portato lì da qualsiasi rotta dello staff', async () => {
    signIn({ mustChangePassword: true })
    renderAt('/ristorante/da-gino/waiter')
    expect(await screen.findByRole('heading', { name: 'Scegli la tua password' })).toBeInTheDocument()
  })

  it('valida le password e poi porta alla sala del proprio ristorante', async () => {
    signIn({ mustChangePassword: true })
    const change = vi.spyOn(api, 'changePassword').mockResolvedValue(NEW_TOKEN)
    const ui = userEvent.setup()
    renderAt('/cambio-password')

    await ui.type(await screen.findByLabelText('Password attuale'), 'provvisoria-1234')
    await ui.type(screen.getByLabelText('Nuova password'), 'corta')
    await ui.type(screen.getByLabelText('Ripeti la nuova password'), 'corta')
    await ui.click(screen.getByRole('button', { name: /Salva la password/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('almeno 12')
    expect(change).not.toHaveBeenCalled()

    await ui.clear(screen.getByLabelText('Nuova password'))
    await ui.type(screen.getByLabelText('Nuova password'), 'una-nuova-password-1')
    await ui.clear(screen.getByLabelText('Ripeti la nuova password'))
    await ui.type(screen.getByLabelText('Ripeti la nuova password'), 'una-nuova-password-2')
    await ui.click(screen.getByRole('button', { name: /Salva la password/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('non coincidono')

    await ui.clear(screen.getByLabelText('Ripeti la nuova password'))
    await ui.type(screen.getByLabelText('Ripeti la nuova password'), 'una-nuova-password-1')
    await ui.click(screen.getByRole('button', { name: /Salva la password/ }))
    await waitFor(() => expect(change).toHaveBeenCalledWith('provvisoria-1234', 'una-nuova-password-1'))
    expect(await screen.findByRole('heading', { name: 'Sala' })).toBeInTheDocument()
  })

  it('mostra l’errore del server (password attuale sbagliata)', async () => {
    signIn({ mustChangePassword: true })
    vi.spyOn(api, 'changePassword').mockRejectedValue(new ApiError(403, 'La password attuale non è corretta'))
    const ui = userEvent.setup()
    renderAt('/cambio-password')
    await ui.type(await screen.findByLabelText('Password attuale'), 'sbagliata')
    await ui.type(screen.getByLabelText('Nuova password'), 'una-nuova-password-1')
    await ui.type(screen.getByLabelText('Ripeti la nuova password'), 'una-nuova-password-1')
    await ui.click(screen.getByRole('button', { name: /Salva la password/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('non è corretta')
  })

  it('un anonimo non vede la pagina', async () => {
    renderAt('/cambio-password')
    expect(await screen.findByRole('heading', { name: 'Accedi.' })).toBeInTheDocument()
  })
})

describe('indirizzi del ristorante', () => {
  it('un anonimo su una rotta del ristorante va al suo accesso', async () => {
    renderAt('/ristorante/da-gino/admin')
    expect(await screen.findByRole('heading', { name: 'Accedi.' })).toBeInTheDocument()
  })

  it('lo staff non entra nel ristorante di un altro: torna al proprio', async () => {
    signIn({ role: 'ADMIN' })
    renderAt('/ristorante/da-lia/admin')
    expect(await screen.findByRole('heading', { name: 'Gestione' })).toBeInTheDocument()
  })

  it('/piattaforma non è un vecchio indirizzo: chi non è admin centrale va alla sua pagina', async () => {
    signIn({ role: 'ADMIN' })
    renderAt('/piattaforma')
    expect(await screen.findByRole('heading', { name: 'Gestione' })).toBeInTheDocument()
  })

  it('i vecchi indirizzi /admin e /waiter portano al ristorante dell’utente', async () => {
    signIn({ role: 'ADMIN' })
    renderAt('/waiter')
    expect(await screen.findByRole('heading', { name: 'Sala' })).toBeInTheDocument()
  })
})
