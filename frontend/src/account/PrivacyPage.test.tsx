import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import PrivacyPage from './PrivacyPage'
import { PRIVACY_CONFIG } from './privacyConfig'

const renderPage = (config = PRIVACY_CONFIG) =>
  render(
    <MemoryRouter>
      <PrivacyPage config={config} />
    </MemoryRouter>,
  )

describe('informativa sulla privacy', () => {
  it('la configurazione consegnata è vuota: il titolare non è inventato', () => {
    expect(Object.values(PRIVACY_CONFIG).every((value) => value === '')).toBe(true)
  })

  it('senza dati del titolare scrive "da indicare"', () => {
    renderPage()
    expect(screen.getByText(/Titolare del trattamento:/).parentElement).toHaveTextContent(
      'Titolare del trattamento: da indicare',
    )
  })

  it('con i dati compilati li mostra', () => {
    renderPage({
      controllerName: 'Trattoria Rossi S.r.l.',
      controllerAddress: 'Via Roma 1, Milano',
      contactEmail: 'privacy@rossi.example',
      updatedAt: '1 gennaio 2027',
    })
    expect(screen.getByText(/Trattoria Rossi S\.r\.l\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'privacy@rossi.example' })).toHaveAttribute(
      'href',
      'mailto:privacy@rossi.example',
    )
  })

  it('copre dati, finalità, conservazione, diritti, browser e fornitori', () => {
    renderPage()
    for (const title of [
      'Quali dati raccogliamo',
      'Perché li usiamo',
      'Per quanto tempo li conserviamo',
      'I tuoi diritti',
      'Cosa salva il browser',
      'Chi ospita i dati',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    expect(screen.getByText(/Vercel/)).toBeInTheDocument()
    expect(screen.getByText(/Neon/)).toBeInTheDocument()
  })
})
