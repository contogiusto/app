import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, type VisitedRestaurant } from '../api/client'
import { tokenFromHash } from './resetToken'
import { auth, loginAsAnna, payment, renderApp } from './testing'

vi.mock('../scanner/ScanPage', () => ({ default: () => <h1>Scanner (finto)</h1> }))

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

const NUOVA = 'una-password-nuova-9'

describe('tokenFromHash', () => {
  it('legge il token dal frammento e rifiuta il resto', () => {
    expect(tokenFromHash('#token=abc_DEF-123')).toBe('abc_DEF-123')
    expect(tokenFromHash('token=abc')).toBe('abc')
    expect(tokenFromHash('')).toBeNull()
    expect(tokenFromHash('#altro=1')).toBeNull()
    expect(tokenFromHash(`#token=${'a'.repeat(201)}`)).toBeNull()
  })
})

describe('password dimenticata', () => {
  it('dalla home si arriva alla richiesta e si mostra la risposta neutra', async () => {
    const user = userEvent.setup()
    const request = vi
      .spyOn(api.customer, 'requestPasswordReset')
      .mockResolvedValue({ detail: 'Se l’email è registrata, ti abbiamo inviato il link.' })
    renderApp('/')
    await user.click(screen.getByRole('link', { name: 'Password dimenticata?' }))
    await user.type(await screen.findByLabelText('Email'), 'anna@example.com')
    await user.click(screen.getByRole('button', { name: /Invia il link/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Se l’email è registrata')
    expect(request).toHaveBeenCalledWith('anna@example.com')
  })

  it('senza email non chiama il server; un errore (troppe richieste) si mostra', async () => {
    const user = userEvent.setup()
    const request = vi
      .spyOn(api.customer, 'requestPasswordReset')
      .mockRejectedValue(new ApiError(429, 'Troppe richieste: riprova tra qualche istante'))
    renderApp('/password-dimenticata')
    await user.click(screen.getByRole('button', { name: /Invia il link/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Inserisci la tua email')
    expect(request).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Email'), 'anna@example.com')
    await user.click(screen.getByRole('button', { name: /Invia il link/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Troppe richieste')
  })
})

describe('nuova password dal link', () => {
  it('manda il token e la password, poi porta all’accesso con l’avviso', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(api.customer, 'confirmPasswordReset').mockResolvedValue(undefined)
    renderApp('/reset-password#token=tok_valido_1234567890')
    await user.type(await screen.findByLabelText('Nuova password'), NUOVA)
    await user.type(screen.getByLabelText('Ripeti la password'), NUOVA)
    await user.click(screen.getByRole('button', { name: /Salva la password/ }))
    await waitFor(() => expect(confirm).toHaveBeenCalledWith('tok_valido_1234567890', NUOVA))
    expect(await screen.findByText('Password cambiata: ora puoi accedere.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Accedi' })).toBeInTheDocument()
  })

  it('valida le password prima di chiamare il server', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(api.customer, 'confirmPasswordReset').mockResolvedValue(undefined)
    renderApp('/reset-password#token=tok_valido_1234567890')
    await user.type(await screen.findByLabelText('Nuova password'), 'corta')
    await user.type(screen.getByLabelText('Ripeti la password'), 'corta')
    await user.click(screen.getByRole('button', { name: /Salva la password/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('da 8 a 128')
    await user.clear(screen.getByLabelText('Nuova password'))
    await user.type(screen.getByLabelText('Nuova password'), NUOVA)
    await user.click(screen.getByRole('button', { name: /Salva la password/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('non coincidono')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('link scaduto o già usato: spiega e offre di chiederne un altro', async () => {
    const user = userEvent.setup()
    vi.spyOn(api.customer, 'confirmPasswordReset').mockRejectedValue(
      new ApiError(400, 'Il link non è valido o è scaduto: richiedine uno nuovo'),
    )
    renderApp('/reset-password#token=tok_scaduto_1234567890')
    await user.type(await screen.findByLabelText('Nuova password'), NUOVA)
    await user.type(screen.getByLabelText('Ripeti la password'), NUOVA)
    await user.click(screen.getByRole('button', { name: /Salva la password/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('scaduto')
    expect(screen.getByRole('link', { name: 'Richiedi un nuovo link' })).toHaveAttribute(
      'href',
      '/password-dimenticata',
    )
  })

  it('toglie il token dalla barra degli indirizzi conservando lo stato del router', async () => {
    const replace = vi.spyOn(window.history, 'replaceState')
    renderApp('/reset-password#token=tok_valido_1234567890')
    await screen.findByLabelText('Nuova password')
    await waitFor(() => expect(replace).toHaveBeenCalled())
    const [, , url] = replace.mock.calls[0]
    expect(String(url)).not.toContain('token')
    expect(String(url)).not.toContain('#')
  })

  it('senza token nel link non mostra il modulo', async () => {
    renderApp('/reset-password')
    expect(await screen.findByRole('alert')).toHaveTextContent('non è completo')
    expect(screen.queryByLabelText('Nuova password')).toBeNull()
  })
})

describe('cambio password dal profilo', () => {
  it('cambia la password e conferma', async () => {
    const user = userEvent.setup()
    loginAsAnna()
    vi.spyOn(api.customer, 'payments').mockResolvedValue([])
    vi.spyOn(api.customer, 'restaurants').mockResolvedValue([])
    const change = vi.spyOn(api.customer, 'changePassword').mockResolvedValue(auth())
    renderApp('/customer/profile')
    await user.type(await screen.findByLabelText('Password attuale'), 'una-password-buona')
    await user.type(screen.getByLabelText('Nuova password'), NUOVA)
    await user.type(screen.getByLabelText('Ripeti la nuova password'), NUOVA)
    await user.click(screen.getByRole('button', { name: 'Cambia password' }))
    expect(await screen.findByText('Password cambiata.')).toBeInTheDocument()
    expect(change).toHaveBeenCalledWith('una-password-buona', NUOVA)
    // La sessione ricordata ora usa il token nuovo (il server ha revocato quello vecchio).
    const saved = JSON.parse(localStorage.getItem('cg:account') ?? '{}') as { token?: string }
    expect(saved.token).toBe(change.mock.results[0] && (await change.mock.results[0].value).access_token)
  })

  it('mostra l’errore della password attuale sbagliata', async () => {
    const user = userEvent.setup()
    loginAsAnna()
    vi.spyOn(api.customer, 'changePassword').mockRejectedValue(
      new ApiError(403, 'La password attuale non è corretta'),
    )
    renderApp('/customer/profile')
    await user.type(await screen.findByLabelText('Password attuale'), 'sbagliata-sbagliata')
    await user.type(screen.getByLabelText('Nuova password'), NUOVA)
    await user.type(screen.getByLabelText('Ripeti la nuova password'), NUOVA)
    await user.click(screen.getByRole('button', { name: 'Cambia password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('non è corretta')
  })
})

const GINO: VisitedRestaurant = {
  slug: 'da-gino',
  name: 'Da Gino',
  visits: 2,
  last_visit: '2026-03-14T19:30:00Z',
  total_paid: '35.50',
}
const LIA: VisitedRestaurant = { ...GINO, slug: 'da-lia', name: 'Da Lia', visits: 1, total_paid: '7.00' }

describe('ristoranti visitati', () => {
  it('la home elenca i ristoranti dove ha pagato, con link al locale', async () => {
    loginAsAnna()
    vi.spyOn(api.customer, 'payments').mockResolvedValue([payment()])
    vi.spyOn(api.customer, 'restaurants').mockResolvedValue([GINO, LIA])
    renderApp('/customer/home')
    const link = await screen.findByRole('link', { name: /Da Gino/ })
    expect(link).toHaveAttribute('href', '/ristorante/da-gino')
    expect(link).toHaveTextContent('2 visite')
    expect(screen.getByRole('link', { name: /Da Lia/ })).toHaveTextContent('1 visita')
  })

  it('senza pagamenti non compare la sezione', async () => {
    loginAsAnna()
    vi.spyOn(api.customer, 'payments').mockResolvedValue([])
    vi.spyOn(api.customer, 'restaurants').mockResolvedValue([])
    renderApp('/customer/home')
    expect(await screen.findByText(/Non hai ancora pagamenti/)).toBeInTheDocument()
    expect(screen.queryByText('I tuoi ristoranti')).toBeNull()
  })

  it('lo storico si filtra per ristorante', async () => {
    const user = userEvent.setup()
    loginAsAnna()
    const payments = vi
      .spyOn(api.customer, 'payments')
      .mockImplementation(async (restaurant?: string) =>
        restaurant === 'da-lia'
          ? [payment({ id: 2, restaurant_name: 'Da Lia' })]
          : [payment({ id: 1, restaurant_name: 'Da Gino' }), payment({ id: 2, restaurant_name: 'Da Lia' })],
      )
    vi.spyOn(api.customer, 'restaurants').mockResolvedValue([GINO, LIA])
    renderApp('/customer/history')
    await user.selectOptions(await screen.findByLabelText('Ristorante'), 'da-lia')
    await waitFor(() => expect(payments).toHaveBeenCalledWith('da-lia'))
    // Nell'elenco restano solo i pagamenti di Da Lia (il nome compare anche nel menu a tendina).
    const inCard = (name: string) => screen.queryAllByText(name).filter((el) => el.tagName !== 'OPTION')
    await waitFor(() => expect(inCard('Da Gino')).toHaveLength(0))
    expect(inCard('Da Lia').length).toBeGreaterThan(0)
  })
})
