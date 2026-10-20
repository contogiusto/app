import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseTableLink } from './parseTableLink'

/**
 * Scanner del QR del tavolo (`/customer/scan`). Il contenuto di ciò che si legge è un dato non
 * fidato: passa SOLO da `parseTableLink`, e si naviga con il router verso il percorso che quella
 * funzione ricostruisce, mai verso il testo letto. La fotocamera si spegne sempre: allo
 * smontaggio, dopo una lettura riuscita e quando la scheda va in background.
 */

type Status =
  | 'starting'
  | 'scanning'
  | 'denied'
  | 'no-camera'
  | 'busy'
  | 'insecure'
  | 'unsupported'
  | 'error'
  | 'done'

const SCAN_INTERVAL_MS = 200
const MAX_FRAME_WIDTH = 640

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type DetectorConstructor = new (options?: { formats?: string[] }) => Detector

const MESSAGES: Record<Exclude<Status, 'scanning' | 'done'>, { title: string; body: string }> = {
  starting: {
    title: 'Richiesta della fotocamera in corso…',
    body: 'Se il browser lo chiede, consenti l’uso della fotocamera.',
  },
  denied: {
    title: 'Permesso alla fotocamera negato',
    body: 'Per scansionare il QR consenti la fotocamera: tocca l’icona del lucchetto (o delle impostazioni del sito) accanto all’indirizzo, abilita la fotocamera e ricarica la pagina. Intanto puoi incollare il link del tavolo qui sotto.',
  },
  'no-camera': {
    title: 'Nessuna fotocamera trovata',
    body: 'Questo dispositivo non ha una fotocamera disponibile. Puoi incollare il link del tavolo qui sotto.',
  },
  busy: {
    title: 'Fotocamera non disponibile',
    body: 'La fotocamera è già in uso da un’altra app o scheda. Chiudila e riprova, oppure incolla il link del tavolo qui sotto.',
  },
  insecure: {
    title: 'Connessione non sicura',
    body: 'La fotocamera funziona solo su una pagina sicura (https). Apri l’app dall’indirizzo https oppure incolla il link del tavolo qui sotto.',
  },
  unsupported: {
    title: 'Browser non supportato',
    body: 'Questo browser non permette di usare la fotocamera dalla pagina. Prova con un altro browser oppure incolla il link del tavolo qui sotto.',
  },
  error: {
    title: 'Non riesco ad aprire la fotocamera',
    body: 'Si è verificato un errore imprevisto. Ricarica la pagina o incolla il link del tavolo qui sotto.',
  },
}

function errorStatus(error: unknown): Status {
  const name = error instanceof DOMException || error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError')
    return 'no-camera'
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy'
  return 'error'
}

export default function ScanPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  /** Cambia a ogni avvio/arresto: i passi asincroni di un avvio superato si fermano da soli. */
  const runRef = useRef(0)
  const lastRejectedRef = useRef<string | null>(null)

  const [status, setStatus] = useState<Status>('starting')
  const [rejected, setRejected] = useState(false)
  const [pasted, setPasted] = useState('')
  const [pasteError, setPasteError] = useState(false)

  const stop = useCallback(() => {
    runRef.current += 1
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  /** Un contenuto letto: valido → si spegne la fotocamera e si apre il tavolo. */
  const handleValue = useCallback(
    (raw: string) => {
      const path = parseTableLink(raw, window.location.origin)
      if (path === null) {
        if (lastRejectedRef.current !== raw) {
          lastRejectedRef.current = raw
          setRejected(true)
        }
        return false
      }
      stop()
      setStatus('done')
      navigate(path)
      return true
    },
    [navigate, stop],
  )

  const start = useCallback(async () => {
    stop()
    const run = runRef.current
    setRejected(false)
    lastRejectedRef.current = null

    if (window.isSecureContext === false) return setStatus('insecure')
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return setStatus('unsupported')
    }
    setStatus('starting')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
    } catch (error) {
      if (run === runRef.current) setStatus(errorStatus(error))
      return
    }
    if (run !== runRef.current) {
      // Nel frattempo la pagina è stata chiusa o messa in background: la fotocamera non resta accesa.
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    streamRef.current = stream

    const video = videoRef.current
    if (video) {
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        // l'avvio automatico può essere bloccato: il flusso resta collegato e riprova da solo
      }
    }
    if (run !== runRef.current) return
    setStatus('scanning')

    const Detector = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector
    const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null

    const tick = async () => {
      if (run !== runRef.current) return
      const frame = videoRef.current
      let value: string | null = null
      try {
        if (frame) {
          if (detector) {
            value = (await detector.detect(frame))[0]?.rawValue ?? null
          } else if (frame.videoWidth > 0) {
            value = await decodeWithJsQr(frame, canvasRef)
          }
        }
      } catch {
        // un fotogramma non leggibile non è un errore: si riprova al prossimo
      }
      if (run !== runRef.current) return
      if (value !== null && handleValue(value)) return
      timerRef.current = window.setTimeout(() => void tick(), SCAN_INTERVAL_MS)
    }
    timerRef.current = window.setTimeout(() => void tick(), SCAN_INTERVAL_MS)
  }, [handleValue, stop])

  useEffect(() => {
    const first = window.setTimeout(() => void start(), 0)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop()
      else void start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(first)
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [start, stop])

  const submitPasted = (event: React.FormEvent) => {
    event.preventDefault()
    const path = parseTableLink(pasted, window.location.origin)
    if (path === null) {
      setPasteError(true)
      return
    }
    stop()
    navigate(path)
  }

  const message = status === 'scanning' || status === 'done' ? null : MESSAGES[status]
  const failed = message !== null && status !== 'starting'

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h1 className="serif" style={{ fontSize: 32, lineHeight: 1.05 }}>
        Scansiona il QR
      </h1>
      <p style={{ color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.5 }}>
        Inquadra il QR che trovi sul tavolo: tieni il telefono fermo, con tutto il codice nel
        riquadro. Quando viene riconosciuto si apre il tavolo.
      </p>

      <div
        style={{
          position: 'relative',
          aspectRatio: '4 / 3',
          borderRadius: 'var(--r-md)',
          overflow: 'hidden',
          background: 'var(--ink)',
          border: '1px solid var(--line)',
          display: status === 'scanning' || status === 'starting' ? 'block' : 'none',
        }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Anteprima della fotocamera"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {status === 'scanning' && (
        <p role="status" style={{ fontSize: 14, color: 'var(--ink-2)' }}>
          Fotocamera attiva: cerco il QR…
        </p>
      )}
      {message && (
        <div
          role={failed ? 'alert' : 'status'}
          className="card"
          style={{ padding: 16, borderColor: failed ? 'var(--clay-deep)' : undefined }}
        >
          <h2 style={{ fontSize: 17, marginBottom: 4 }}>{message.title}</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>{message.body}</p>
          {failed && status !== 'unsupported' && status !== 'insecure' && (
            <button
              type="button"
              className="btn btn--ghost"
              style={{ marginTop: 12 }}
              onClick={() => void start()}
            >
              Riprova
            </button>
          )}
        </div>
      )}
      {rejected && status === 'scanning' && (
        <p
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            background: 'var(--clay-tint)',
            color: 'var(--clay-deep)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          QR non riconosciuto: non è il QR di un tavolo di questa app.
        </p>
      )}

      <form onSubmit={submitPasted} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="field-label" htmlFor="table-link">
          Incolla il link del tavolo
        </label>
        <input
          id="table-link"
          className="field"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Es. https://…/table/5?token=…"
          value={pasted}
          aria-describedby={pasteError ? 'table-link-error' : undefined}
          aria-invalid={pasteError}
          onChange={(e) => {
            setPasted(e.target.value)
            setPasteError(false)
          }}
        />
        {pasteError && (
          <p id="table-link-error" role="alert" style={{ color: 'var(--clay-deep)', fontSize: 14, fontWeight: 600 }}>
            Link non riconosciuto: incolla il link completo del tavolo, quello del QR.
          </p>
        )}
        <button type="submit" className="btn" disabled={pasted.trim() === ''}>
          Apri il tavolo
        </button>
      </form>
    </div>
  )
}

/** Fallback senza BarcodeDetector: un fotogramma ridotto su canvas, letto con jsQR (caricato solo qui). */
async function decodeWithJsQr(
  video: HTMLVideoElement,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
): Promise<string | null> {
  const canvas = (canvasRef.current ??= document.createElement('canvas'))
  const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth)
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const { default: jsQR } = await import('jsqr')
  return jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data ?? null
}
