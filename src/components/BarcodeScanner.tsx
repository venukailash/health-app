import { useEffect, useRef, useState } from 'react'
import Button from './Button'

type Stage =
  | 'starting'
  | 'scanning'
  | 'looking'
  | 'notFound'
  | 'denied'
  | 'unsupported'
  | 'failed'

/** Formats worth scanning on supermarket packaging. */
const PRODUCT_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] as const

/** How long a barcode can go unread before the camera admits it is struggling. */
const STRUGGLING_AFTER_MS = 8000
/** How long a failed lookup stays on screen before scanning resumes. */
const SHOW_FAILURE_MS = 2500

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>
}

/**
 * Full-screen camera overlay that reads a product barcode.
 *
 * Two decoders, because one is not enough: Chrome on Android has a native
 * `BarcodeDetector` that is fast and free, while iOS Safari has none — so
 * ZXing is lazy-loaded only where it is actually needed, keeping ~200 KB out
 * of the bundle everyone else downloads.
 *
 * `onDetected` says whether the code led anywhere. A false keeps the camera
 * open and goes back to scanning, because the usual reason a lookup fails is
 * that the wrong thing was read — and closing the camera to show a toast
 * means opening it again to try, which is the whole job twice.
 *
 * Typing the number in is always available: camera permission gets denied,
 * lenses get scratched, and a barcode on a crumpled wrapper may simply not
 * read. Choosing to type STOPS the camera — it has nothing to do while
 * someone is using the keyboard, and leaving it running behind the form
 * drains the battery and looks like the app is still watching.
 */
export default function BarcodeScanner({
  onDetected,
  onCancel,
}: {
  onDetected: (barcode: string) => Promise<boolean>
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stage, setStage] = useState<Stage>('starting')
  const [code, setCode] = useState('')
  const [struggling, setStruggling] = useState(false)
  const [typing, setTyping] = useState(false)
  const [manual, setManual] = useState('')

  // Held in a ref so a parent re-render cannot restart the camera mid-scan:
  // every caller passes an inline arrow, which is a new function each time.
  const detectedRef = useRef(onDetected)
  useEffect(() => {
    detectedRef.current = onDetected
  })

  /*
   * Codes already looked up and found wanting. The packet does not leave the
   * frame when a lookup fails, so without this the same unknown barcode is
   * read, queried and refused every couple of seconds for as long as it is
   * held there — a loop against someone else's API.
   */
  const tried = useRef(new Set<string>())

  useEffect(() => {
    // Nothing for the camera to do while the keyboard is up.
    if (typing) return

    let stream: MediaStream | null = null
    let frame = 0
    let stopZxing: (() => void) | null = null
    let resume = 0
    let cancelled = false
    // Blocks further reads while one is being looked up, or while its failure
    // is still on screen.
    let busy = false

    const handle = async (barcode: string) => {
      if (busy || cancelled || tried.current.has(barcode)) return
      busy = true
      setCode(barcode)
      setStage('looking')

      const used = await detectedRef.current(barcode)
      if (cancelled || used) return

      tried.current.add(barcode)
      setStage('notFound')
      resume = window.setTimeout(() => {
        if (cancelled) return
        busy = false
        setStage('scanning')
      }, SHOW_FAILURE_MS)
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStage('unsupported')
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
      } catch (error) {
        setStage(
          error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'failed',
        )
        return
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      // iOS refuses to play an unmuted inline video without a gesture.
      video.muted = true
      video.setAttribute('playsinline', 'true')
      await video.play().catch(() => undefined)
      setStage('scanning')

      const Native = (globalThis as { BarcodeDetector?: new (options: { formats: readonly string[] }) => BarcodeDetectorLike })
        .BarcodeDetector

      if (Native) {
        const detector = new Native({ formats: PRODUCT_FORMATS })
        const tick = async () => {
          if (cancelled) return
          if (!busy) {
            try {
              const results = await detector.detect(video)
              if (results.length > 0 && results[0].rawValue) {
                void handle(results[0].rawValue)
              }
            } catch {
              // A transient decode failure is normal between frames.
            }
          }
          frame = requestAnimationFrame(() => void tick())
        }
        void tick()
        return
      }

      // No native detector (iOS Safari): pull ZXing in on demand.
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (cancelled) return
        const reader = new BrowserMultiFormatReader()
        const controls = await reader.decodeFromVideoElement(video, (result) => {
          if (result && !busy) void handle(result.getText())
        })
        stopZxing = () => controls.stop()
      } catch {
        setStage('failed')
      }
    }

    void start()

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      clearTimeout(resume)
      stopZxing?.()
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [typing])

  // Says so rather than leaving someone holding a packet at a blank screen.
  useEffect(() => {
    if (stage !== 'scanning') {
      setStruggling(false)
      return
    }
    const timer = setTimeout(() => setStruggling(true), STRUGGLING_AFTER_MS)
    return () => clearTimeout(timer)
  }, [stage])

  const message: Record<Stage, string> = {
    starting: 'Starting the camera…',
    scanning: struggling
      ? 'Still looking. Hold steady about 15 cm away, or type the number below.'
      : 'Point the camera at the barcode',
    looking: `Read ${code} — looking it up…`,
    notFound: `Nothing came back for ${code}. Still scanning — try another angle.`,
    denied: 'Camera access was declined. You can type the number instead.',
    unsupported: 'This browser cannot use the camera. Type the number instead.',
    failed: 'The camera could not be started. Type the number instead.',
  }

  const cameraRunning = !typing && (stage === 'starting' || stage === 'scanning' || stage === 'looking' || stage === 'notFound')

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'var(--surface)' }}>
      {!typing && (
        <div className="relative flex-1 overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            aria-label="Camera preview"
          />
          {cameraRunning && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-72 max-w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-xl"
              style={{
                boxShadow: `0 0 0 3px ${
                  stage === 'looking'
                    ? 'var(--color-brand)'
                    : stage === 'notFound'
                      ? 'var(--color-over)'
                      : 'rgba(255,255,255,0.9)'
                }, 0 0 0 9999px rgba(0,0,0,0.45)`,
              }}
            />
          )}
        </div>
      )}

      <div
        className={typing ? 'flex flex-1 flex-col justify-center px-4' : 'px-4 pt-4'}
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        {/* Spoken as it changes, so the stage is not something only the sighted
            can follow. */}
        <p role="status" aria-live="polite" className="mb-3 text-center text-sm muted">
          {typing ? 'Camera off. Type the number from the packet.' : message[stage]}
        </p>

        <form
          className="mb-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const digits = manual.replace(/\D/g, '')
            if (digits.length >= 6) void detectedRef.current(digits)
          }}
        >
          <input
            className="field"
            type="text"
            inputMode="numeric"
            placeholder="Or type the barcode number"
            aria-label="Barcode number"
            value={manual}
            onFocus={() => setTyping(true)}
            onChange={(event) => setManual(event.target.value)}
          />
          <Button type="submit" disabled={manual.replace(/\D/g, '').length < 6}>
            Look up
          </Button>
        </form>

        <div className="flex gap-2">
          {typing && (
            <Button variant="secondary" className="flex-1" onClick={() => setTyping(false)}>
              Use the camera
            </Button>
          )}
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
