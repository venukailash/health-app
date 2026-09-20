import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ToastTone = 'info' | 'error' | 'success'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
  /** Optional inline action, e.g. "Reload". */
  action?: { label: string; onClick: () => void }
}

interface ToastValue {
  toasts: Toast[]
  showToast: (message: string, options?: { tone?: ToastTone; duration?: number; action?: Toast['action'] }) => number
  dismissToast: (id: number) => void
}

const ToastContext = createContext<ToastValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const showToast = useCallback<ToastValue['showToast']>(
    (message, { tone = 'info', duration = 4000, action } = {}) => {
      const id = nextId.current++
      setToasts((current) => [...current.filter((toast) => toast.message !== message), { id, message, tone, action }])
      // A toast with an action stays until dismissed; it is asking for a choice.
      if (duration > 0 && !action) {
        timers.current.set(id, setTimeout(() => dismissToast(id), duration))
      }
      return id
    },
    [dismissToast],
  )

  const value = useMemo(() => ({ toasts, showToast, dismissToast }), [toasts, showToast, dismissToast])
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside a ToastProvider')
  return value
}
