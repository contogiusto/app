import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScanPage from './ScanPage'

const jsqr = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('jsqr', () => ({ default: jsqr.read }))

const ORIGIN = window.location.origin
const VALID = `${ORIGIN}/table/5?token=tok`

function Table() {
  const { pathname, search } = useLocation()
  return <p data-testid="table">{pathname + search}</p>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/customer/scan']}>
      <Routes>
        <Route path="/customer/scan" element={<ScanPage />} />
        <Route path="/table/:tableId" element={<Table />} />
        <Route path="*" element={<p data-testid="elsewhere" />} />
      </Routes>
    </MemoryRouter>,
  )
}

const track = () => ({ stop: vi.fn() })
type FakeTrack = ReturnType<typeof track>
const fakeStream = (tracks: FakeTrack[]) =>
  ({ getTracks: () => tracks }) as unknown as MediaStream

const getUserMedia = vi.fn()
const detect = vi.fn()
const originalDetector = (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector

function withDetector(enabled: boolean) {
  const w = window as unknown as { BarcodeDetector?: unknown }
  if (enabled) {
    w.BarcodeDetector = class {
      detect = detect
    }
  } else {
    delete w.BarcodeDetector
  }
}

/** Fa fallire getUserMedia come il browser: con un DOMException del nome dato. */
const failWith = (name: string) => getUserMedia.mockRejectedValue(new DOMException('x', name))

beforeEach(() => {
  getUserMedia.mockReset()
  detect.mockReset()
  jsqr.read.mockReset()
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  withDetector(true)
  detect.mockResolvedValue([])
})

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(window, 'BarcodeDetector', {
    configurable: true,
    writable: true,
    value: originalDetector,
  })
  if (originalDetector === undefined) delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector
})

describe('con BarcodeDetector', () => {
  it('chiede la fotocamera posteriore e, letto un QR valido, apre il tavolo e spegne la fotocamera', async () => {
    const t = track()
    getUserMedia.mockResolvedValue(fakeStream([t]))
    detect.mockResolvedValue([{ rawValue: VALID }])
    renderPage()

    expect(await screen.findByTestId('table')).toHaveTextContent('/table/5?token=tok')
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: 'environment' },
      audio: false,
    })
    expect(t.stop).toHaveBeenCalled()
  })

  it('un QR estraneo è rifiutato: nessuna navigazione, si continua a cercare', async () => {
    const t = track()
    getUserMedia.mockResolvedValue(fakeStream([t]))
    detect.mockResolvedValue([{ rawValue: 'https://evil.example/table/5?token=tok' }])
    renderPage()

    expect(await screen.findByText(/QR non riconosciuto/)).toBeInTheDocument()
    expect(screen.queryByTestId('table')).not.toBeInTheDocument()
    expect(screen.queryByTestId('elsewhere')).not.toBeInTheDocument()
    expect(t.stop).not.toHaveBeenCalled()

    // Poi arriva quello giusto.
    detect.mockResolvedValue([{ rawValue: VALID }])
    expect(await screen.findByTestId('table')).toHaveTextContent('/table/5?token=tok')
  })

  it('un testo qualsiasi nel QR non fa navigare', async () => {
    getUserMedia.mockResolvedValue(fakeStream([track()]))
    detect.mockResolvedValue([{ rawValue: 'javascript:alert(1)' }])
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('QR non riconosciuto')
    expect(screen.queryByTestId('table')).not.toBeInTheDocument()
  })

  it('ferma i track allo smontaggio', async () => {
    const t = track()
    getUserMedia.mockResolvedValue(fakeStream([t]))
    const { unmount } = renderPage()
    await screen.findByText(/Fotocamera attiva/)
    expect(t.stop).not.toHaveBeenCalled()
    unmount()
    expect(t.stop).toHaveBeenCalled()
  })

  it('se si esce prima che il permesso sia concesso, la fotocamera non resta accesa', async () => {
    const t = track()
    let grant: (s: MediaStream) => void = () => {}
    getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => (grant = resolve)))
    const { unmount } = renderPage()
    expect(await screen.findByText(/Richiesta della fotocamera/)).toBeInTheDocument()
    unmount()
    grant(fakeStream([t]))
    await waitFor(() => expect(t.stop).toHaveBeenCalled())
  })

  it('ferma la fotocamera quando la scheda va in background e la riapre al ritorno', async () => {
    const first = track()
    const second = track()
    getUserMedia
      .mockResolvedValueOnce(fakeStream([first]))
      .mockResolvedValueOnce(fakeStream([second]))
    renderPage()
    await screen.findByText(/Fotocamera attiva/)

    const state = vi.spyOn(document, 'visibilityState', 'get')
    state.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(first.stop).toHaveBeenCalled()

    state.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2))
    expect(second.stop).not.toHaveBeenCalled()
  })
})

describe('senza BarcodeDetector (jsQR)', () => {
  it('legge il fotogramma dal canvas e apre il tavolo', async () => {
    withDetector(false)
    const t = track()
    getUserMedia.mockResolvedValue(fakeStream([t]))
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(1280)
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(720)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(4), width: 640, height: 360 }),
    } as unknown as CanvasRenderingContext2D)
    jsqr.read.mockReturnValue({ data: VALID })
    renderPage()

    expect(await screen.findByTestId('table')).toHaveTextContent('/table/5?token=tok')
    expect(t.stop).toHaveBeenCalled()
  })

  it('un QR estraneo letto da jsQR è rifiutato', async () => {
    withDetector(false)
    getUserMedia.mockResolvedValue(fakeStream([track()]))
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640)
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(480)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(4), width: 640, height: 480 }),
    } as unknown as CanvasRenderingContext2D)
    jsqr.read.mockReturnValue({ data: '//evil/table/5?token=tok' })
    renderPage()
    expect(await screen.findByText(/QR non riconosciuto/)).toBeInTheDocument()
    expect(screen.queryByTestId('table')).not.toBeInTheDocument()
  })
})

describe('stati della fotocamera', () => {
  it.each([
    ['NotAllowedError', /Permesso alla fotocamera negato/, /ricarica la pagina/],
    ['NotFoundError', /Nessuna fotocamera trovata/, /link del tavolo/],
    ['NotReadableError', /Fotocamera non disponibile/, /già in uso/],
    ['QualcosaDiStrano', /Non riesco ad aprire la fotocamera/, /errore imprevisto/],
  ])('%s', async (name, title, body) => {
    failWith(name)
    renderPage()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(title)
    expect(alert).toHaveTextContent(body)
    // L'alternativa manuale c'è sempre.
    expect(screen.getByLabelText('Incolla il link del tavolo')).toBeInTheDocument()
  })

  it('contesto non sicuro: spiega che serve https e non chiede la fotocamera', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(/https/)
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Incolla il link del tavolo')).toBeInTheDocument()
  })

  it('browser senza getUserMedia: messaggio dedicato', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Browser non supportato')
    expect(screen.getByLabelText('Incolla il link del tavolo')).toBeInTheDocument()
  })

  it('durante la richiesta del permesso lo annuncia come stato', async () => {
    getUserMedia.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(await screen.findByRole('status')).toHaveTextContent(/Richiesta della fotocamera/)
  })

  it('"Riprova" richiede di nuovo la fotocamera', async () => {
    const user = userEvent.setup()
    failWith('NotAllowedError')
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Riprova' }))
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })
})

describe('link incollato', () => {
  async function paste(text: string) {
    const user = userEvent.setup()
    failWith('NotFoundError') // come su un desktop senza fotocamera
    renderPage()
    await user.type(await screen.findByLabelText('Incolla il link del tavolo'), text)
    await user.click(screen.getByRole('button', { name: 'Apri il tavolo' }))
  }

  it('un link valido apre il tavolo', async () => {
    await paste(VALID)
    expect(await screen.findByTestId('table')).toHaveTextContent('/table/5?token=tok')
  })

  it.each([
    'https://evil.example/table/5?token=tok',
    `${ORIGIN}/table/5`,
    `${ORIGIN}/table/abc?token=x`,
    `${ORIGIN}/admin?token=x`,
    '/table/5?token=tok',
    'ciao',
  ])('il link non valido %s è rifiutato', async (text) => {
    await paste(text)
    expect(await screen.findByText(/Link non riconosciuto/)).toBeInTheDocument()
    expect(screen.queryByTestId('table')).not.toBeInTheDocument()
    expect(screen.queryByTestId('elsewhere')).not.toBeInTheDocument()
  })

  it('con il campo vuoto il pulsante è disabilitato', async () => {
    failWith('NotFoundError')
    renderPage()
    expect(await screen.findByRole('button', { name: 'Apri il tavolo' })).toBeDisabled()
  })
})
