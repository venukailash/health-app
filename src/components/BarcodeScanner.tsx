import { useEffect, useRef, useState } from 'react'
import Button from './Button'

type Status = 'starting' | 'scanning' | 'denied' | 'unsupported' | 'failed'

/** Formats worth scanning on supermarket packaging. */
const PRODUCT_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] as const

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
 * Typing the number in is always available: camera permission gets denied,
 * lenses get scratched, and a barcode on a crumpled wrapper may simply not
 * read.
 */
export default function BarcodeScanner({
  onDetected,
  onCancel,
}: {
  onDetected: (barcode: string) => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<Status>('starting')
  const [manual, setManual] = useState('')
  const settled = useRef(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let frame = 0
    let stopZxing: (() => void) | null = null
    let cancelled = false

    const finish = (barcode: string) => {
      if (settled.current || cancelled) return
      settled.current = true
      onDetected(barcode)
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported')
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
      } catch (error) {
        setStatus(
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
      setStatus('scanning')

      const Native = (globalThis as { BarcodeDetector?: new (options: { formats: readonly string[] }) => BarcodeDetectorLike })
        .BarcodeDetector

      if (Native) {
        const detector = new Native({ formats: PRODUCT_FORMATS })
        const tick = async () => {
          if (cancelled || settled.current) return
          try {
            const results = await detector.detect(video)
            if (results.length > 0 && results[0].rawValue) {
              finish(results[0].rawValue)
              return
            }
          } catch {
            // A transient decode failure is normal between frames.
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
          if (result) finish(result.getText())
        })
        stopZxing = () => controls.stop()
      } catch {
        setStatus('failed')
      }
    }

    void start()

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      stopZxing?.()
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [onDetected])

  const message: Record<Status, string> = {
    starting: 'Starting the camera…',
    scanning: 'Point the camera at the barcode',
    denied: 'Camera access was declined. You can type the number instead.',
    unsupported: 'This browser cannot use the camera. Type the number instead.',
    failed: 'The camera could not be started. Type the number instead.',
  }

  const cameraUsable = status === 'starting' || status === 'scanning'

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'var(--surface)' }}>
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          aria-label="Camera preview"
        />
        {cameraUsable && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-72 max-w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-xl"
            style={{ boxShadow: '0 0 0 3px rgba(255,255,255,0.9), 0 0 0 9999px rgba(0,0,0,0.45)' }}
          />
        )}
      </div>

      <div className="px-4 pb-6 pt-4" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
        <p className="mb-3 text-center text-sm muted">{message[status]}</p>

        <form
          className="mb-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const digits = manual.replace(/\D/g, '')
            if (digits.length >= 6) onDetected(digits)
          }}
        >
          <input
            className="field"
            type="text"
            inputMode="numeric"
            placeholder="Or type the barcode number"
            aria-label="Barcode number"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
          />
          <Button type="submit" disabled={manual.replace(/\D/g, '').length < 6}>
            Look up
          </Button>
        </form>

        <Button variant="secondary" onClick={onCancel} className="w-full">
          Cancel
        </Button>
      </div>
    </div>
  )
}
