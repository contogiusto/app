import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '../api/client'
import { ANNA, loginAsAnna, renderApp } from './testing'

vi.mock('../scanner/ScanPage', () => ({ default: () => <h1>Scanner (finto)</h1> }))

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('profilo: dati', () => {
  it('mostra i dati, con l’email in sola lettura', async () => {
    loginAsAnna()
    renderApp('/customer/profile')
    expect(await screen.findByLabelText('Nome')).toHaveValue('Anna')
    expect(screen.getByLabelText('Cognome')).toHaveValue('Russo')
    expect(screen.getByLabelText(/Città/)).toHaveValue('Milano')
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'Salva modifiche' })).toBeDisabled()
  })

  it('modifica e salva: aggiorna anche il nome nell’intestazione e nella memoria', async () => {
    const user = userEvent.setup()
    loginAsAnna()
    const update = vi
      .spyOn(api.customer, 'update')
      .mockResolvedValue({ ...ANNA, first_name: 'Annalisa', city: null })
    renderApp('/customer/profile')
    const nome = await screen.findByLabelText('Nome')
    await user.clear(nome)
    await user.type(nome, 'Annalisa')
    await user.clear(screen.getByLabelText(/Città/))
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    expect(await screen.findByText('Dati salvati.')).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith({ first_name: 'Annalisa', last_name: 'Russo', city: null })
    const header = screen.getByRole('navigation', { name: 'Principale' }).parentElement!
    expect(within(header).getByText('Annalisa')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('cg:account')!).customer.first_name).toBe('Annalisa')
  })

  it('un errore dell’API si mostra e i dati restano modificabili', async () => {
    const user = userEvent.setup()
    loginAsAnna()
    vi.spyOn(api.customer, 'update').mockRejectedValue(new ApiError(422, 'Dati non validi'))
    renderApp('/customer/profile')
    await user.type(await screen.findByLabelText('Nome'), 'x')
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Dati non validi')
  })

  it('nome vuoto: non si invia', async () => {
    const user = userEvent.setup()
    loginAsAnna()
    const update = vi.spyOn(api.customer, 'update')
    renderApp('/customer/profile')
    await user.clear(await screen.findByLabelText('Nome'))
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nome e cognome')
    expect(update).not.toHaveBeenCalled()
  })
})

describe('profilo: elimina account', () => {
  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /Elimina il mio account/ }))
    return screen.findByRole('alertdialog', { name: /Eliminare l’account/ })
  }

  it('la finestra spiega cosa si cancella e cosa resta, e dà il focus alla password', async () => {
    const user = userEvent.setup()
    loginAsAnna()
    renderApp('/customer/profile')
    const dialog = await openDialog(user)
    expect(within(dialog).getByText(/Viene cancellato/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Resta:/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Password')).toHaveFocus()
  })

  it('Esc e Annulla chiudono senza eliminare, e il focus torna al pulsante', async () => {
    const user = userEvent.setup()
    loginAsAnna()
    const remove = vi.spyOn(api.customer, 'remove')
    renderApp('/customer/profile')
    await openDialog(user)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Elimina il mio account/ })).toHaveFocus()
    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(remove).not.toHaveBeenCalled()
  })

  it('password sbagliata (403): messaggio nella finestra, l’account resta', async () => {
    const user = userEvent.setup()
    loginAsAnna()
    vi.spyOn(api.customer, 'remove').mockRejectedValue(new ApiError(403, 'Password non corretta'))
    renderApp('/customer/profile')
    const dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('Password'), 'sbagliata')
    await user.click(within(dialog).getByRole('button', { name: 'Elimina definitivamente' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Password non corretta')
    expect(localStorage.getItem('cg:account')).not.toBeNull()
  })

  it('senza password non chiama l’API', async () => {
    const user = userEvent.setup()
    loginAsAnna()
    const remove = vi.spyOn(api.customer, 'remove')
    renderApp('/customer/profile')
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Elimina definitivamente' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('password')
    expect(remove).not.toHaveBeenCalled()
  })

  it('password giusta: esce e torna alla home con un messaggio', async () => {
    const user = userEvent.setup()
    loginAsAnna()
    const remove = vi.spyOn(api.customer, 'remove').mockResolvedValue(undefined)
    renderApp('/customer/profile')
    const dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('Password'), 'una-password-buona')
    await user.click(within(dialog).getByRole('button', { name: 'Elimina definitivamente' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('una-password-buona'))
    expect(await screen.findByText('Il tuo account è stato eliminato.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Accedi' })).toBeInTheDocument()
    expect(localStorage.getItem('cg:account')).toBeNull()
    // niente ritorno al profilo di un account che non esiste più
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
