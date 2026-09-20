import { useStore } from '../state/AppStore'

/** Local storage is the only store, so a failed write has to be visible. */
export default function StorageBanner() {
  const { storageError, dismissStorageError } = useStore()
  if (!storageError) return null

  return (
    <div
      role="alert"
      className="mx-auto mb-2 flex max-w-2xl items-start gap-3 px-4 py-3 text-sm text-white"
      style={{ background: 'var(--color-over)' }}
    >
      <span className="flex-1">{storageError} Recent changes may not have been saved.</span>
      <button type="button" onClick={dismissStorageError} className="font-semibold underline">
        Dismiss
      </button>
    </div>
  )
}
