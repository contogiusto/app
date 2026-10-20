import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '../api/client'
import { auth, loginAsAnna, renderApp } from './testing'

// Le schermate vere hanno i loro test: qui conta solo dove si arriva.
vi.mock('../customer/CustomerApp', async () => {
  const { Where } = await import('./where')
  return { CustomerApp: () => <Where /> }
})
vi.mock('../scanner/ScanPage', () => ({ default: () => <h1>Scanner (finto)</h1> }))
vi.mock('./AccountHome', async () => {
  const { Where } = await import('./where')
  return { default: () => <Where /> }
})

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

type User = ReturnType<typeof userEvent.setup>

async function fillLogin(user: User) {
  await user.type(screen.getByLabelText('Email'), 'anna@example.com')
  await user.type(screen.getByLabelText('Password'), 'una-password-buona')
  await user.click(screen.getByRole('button', { name: /Accedi/ }))
}

async function fillRegister(user: User, { privacy = true }: { privacy?: boolean } = {}) {
  await user.type(screen.getByLabelText('Nome'), 'Anna')
  await user.type(screen.getByLabelText('Cognome'), 'Russo')
  await user.type(screen.getByLabelText('Email'), 'anna@example.com')
  await user.type(screen.getByLabelText('Password'), 'una-password-buona')
  if (privacy) await user.click(screen.getByLabelText(/Ho letto/))
  await user.click(screen.getByRole('button', { name: /Crea account/ }))
}

describe('home: accesso', () => {
  it('login riuscito: porta alla home dell’area cliente', async () => {
    const user = userEvent.setup()
    const login = vi.spyOn(api.customer, 'login').mockResolvedValue(auth())
    renderApp('/')
    await fillLogin(user)
    expect(await screen.findByTestId('where')).toHaveTextContent('/customer/home')
    expect(login).toHaveBeenCalledWith('anna@example.com', 'una-password-buona')
  })

  it('ritorna al tavolo da cui si è partiti, con la query intera', async () => {
    const user = userEvent.setup()
    vi.spyOn(api.customer, 'login').mockResolvedValue(auth())
    renderApp('/?redirect=%2Ftable%2F5%3Ftoken%3Dabc')
    await fillLogin(user)
    expect(await screen.findByTestId('where')).toHaveTextContent('/table/5?token=abc')
  })

  it('un redirect verso un sito esterno si ignora', async () => {
    const user = userEvent.setup()
    vi.spyOn(api.customer, 'login').mockResolvedValue(auth())
    renderApp('/?redirect=https%3A%2F%2Fsito-esterno.example')
    await fillLogin(user)
    expect(await screen.findByTestId('where')).toHaveTextContent('/customer/home')
  })

  it.each([
    [401, 'Credenziali non valide'],
    [429, 'Troppe richieste: riprova tra poco'],
  ])('errore %i: mostra il messaggio dell’API e resta sul modulo', async (status, text) => {
    const user = userEvent.setup()
    vi.spyOn(api.customer, 'login').mockRejectedValue(new ApiError(status, text))
    renderApp('/')
    await fillLogin(user)
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(screen.getByRole('button', { name: /Accedi/ })).toBeEnabled()
  })

  it('durante la richiesta il pulsante è disabilitato', async () => {
    const user = userEvent.setup()
    let finish!: (value: ReturnType<typeof auth>) => void
    vi.spyOn(api.customer, 'login').mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderApp('/')
    await fillLogin(user)
    expect(screen.getByRole('button', { name: /Un attimo/ })).toBeDisabled()
    finish(auth())
    await screen.findByTestId('where')
  })

  it('campi vuoti: avvisa senza chiamare l’API', async () => {
    const user = userEvent.setup()
    const login = vi.spyOn(api.customer, 'login')
    renderApp('/')
    await user.click(screen.getByRole('button', { name: /Accedi/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('email e password')
    expect(login).not.toHaveBeenCalled()
  })

  it('già collegato: va subito al ritorno', async () => {
    loginAsAnna()
    renderApp('/?redirect=%2Ftable%2F5%3Ftoken%3Dabc')
    expect(await screen.findByTestId('where')).toHaveTextContent('/table/5?token=abc')
  })

  it('link all’accesso staff e promemoria che l’account non serve per pagare', () => {
    renderApp('/')
    expect(screen.getByRole('link', { name: 'Accesso staff' })).toHaveAttribute(
      'href',
      '/staff/login',
    )
    expect(screen.getByText(/l’account non serve/)).toBeInTheDocument()
  })
})

describe('home: registrazione', () => {
  it('?mode=register apre la scheda Registrati', () => {
    renderApp('/?mode=register')
    expect(screen.getByRole('tab', { name: 'Registrati' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Nome')).toHaveAttribute('autocomplete', 'given-name')
    expect(screen.getByLabelText('Cognome')).toHaveAttribute('autocomplete', 'family-name')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
  })

  it('si passa da una scheda all’altra', async () => {
    const user = userEvent.setup()
    renderApp('/')
    await user.click(screen.getByRole('tab', { name: 'Registrati' }))
    expect(screen.getByLabelText('Nome')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Accedi' }))
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
  })

  it('registrazione riuscita: invia accept_privacy e porta al ritorno', async () => {
    const user = userEvent.setup()
    const register = vi.spyOn(api.customer, 'register').mockResolvedValue(auth())
    renderApp('/?mode=register&redirect=%2Ftable%2F5%3Ftoken%3Dabc')
    await fillRegister(user)
    expect(await screen.findByTestId('where')).toHaveTextContent('/table/5?token=abc')
    expect(register).toHaveBeenCalledWith({
      first_name: 'Anna',
      last_name: 'Russo',
      city: null,
      email: 'anna@example.com',
      password: 'una-password-buona',
      accept_privacy: true,
    })
    expect(JSON.stringify({ ...localStorage })).not.toContain('una-password-buona')
  })

  it('con la città la invia, senza spazi attorno', async () => {
    const user = userEvent.setup()
    const register = vi.spyOn(api.customer, 'register').mockResolvedValue(auth())
    renderApp('/?mode=register')
    await user.type(screen.getByLabelText(/Città/), ' Torino ')
    await fillRegister(user)
    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(expect.objectContaining({ city: 'Torino' })),
    )
  })

  it('privacy non spuntata: non si invia', async () => {
    const user = userEvent.setup()
    const register = vi.spyOn(api.customer, 'register')
    renderApp('/?mode=register')
    await fillRegister(user, { privacy: false })
    expect(await screen.findByRole('alert')).toHaveTextContent('informativa sulla privacy')
    expect(register).not.toHaveBeenCalled()
  })

  it('password troppo corta: non si invia', async () => {
    const user = userEvent.setup()
    const register = vi.spyOn(api.customer, 'register')
    renderApp('/?mode=register')
    await user.type(screen.getByLabelText('Nome'), 'Anna')
    await user.type(screen.getByLabelText('Cognome'), 'Russo')
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.type(screen.getByLabelText('Password'), 'corta')
    await user.click(screen.getByLabelText(/Ho letto/))
    await user.click(screen.getByRole('button', { name: /Crea account/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('da 8 a 128 caratteri')
    expect(register).not.toHaveBeenCalled()
  })

  it.each([
    [409, 'Email già registrata'],
    [429, 'Troppe richieste'],
    [422, 'Dati non validi'],
  ])('errore %i: mostra il messaggio dell’API', async (status, text) => {
    const user = userEvent.setup()
    vi.spyOn(api.customer, 'register').mockRejectedValue(new ApiError(status, text))
    renderApp('/?mode=register')
    await fillRegister(user)
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
  })

  it('il link all’informativa si apre in una nuova scheda', () => {
    renderApp('/?mode=register')
    const link = screen.getByRole('link', { name: /informativa sulla privacy/ })
    expect(link).toHaveAttribute('href', '/privacy')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
