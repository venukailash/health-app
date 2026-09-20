import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useToast } from '../state/ToastProvider'

/** How often an open app asks whether a new build has been deployed. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000

function isTyping(): boolean {
  const active = document.activeElement
  if (!active) return false
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    (active as HTMLElement).isContentEditable === true
  )
}

/**
 * Keeps the installed app up to date with whatever is deployed.
 *
 * The service worker is registered in `prompt` mode rather than `autoUpdate`,
 * not to make the user decide but so the reload is ours to schedule: an
 * automatic reload can land mid-sentence while someone is typing a food in and
 * throw the entry away. We apply the update immediately when the app is idle,
 * and wait for the field to lose focus when it is not.
 *
 * A service worker only looks for a new build on navigation, which an
 * installed PWA can go days without doing, so we also poll hourly and whenever
 * the app comes back to the foreground.
 */
export function useAppUpdate() {
  const { showToast } = useToast()
  const applied = useRef(false)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return

      const check = () => {
        if (navigator.onLine) void registration.update()
      }
      const timer = setInterval(check, CHECK_INTERVAL_MS)
      const onVisible = () => {
        if (document.visibilityState === 'visible') check()
      }
      document.addEventListener('visibilitychange', onVisible)

      // The registration outlives the component, so this only tidies up on
      // a full teardown (tests, hot reload).
      return () => {
        clearInterval(timer)
        document.removeEventListener('visibilitychange', onVisible)
      }
    },
  })

  useEffect(() => {
    if (!needRefresh || applied.current) return

    const apply = () => {
      if (applied.current) return
      applied.current = true
      void updateServiceWorker(true)
    }

    if (!isTyping()) {
      showToast('Updating to the latest version…', { tone: 'success', duration: 1500 })
      const timer = setTimeout(apply, 600)
      return () => clearTimeout(timer)
    }

    // Mid-entry: tell them it is ready and apply once they are done.
    showToast('A new version is ready.', {
      tone: 'info',
      duration: 0,
      action: { label: 'Reload', onClick: apply },
    })
    const onBlur = () => {
      if (!isTyping()) apply()
    }
    document.addEventListener('focusout', onBlur)
    return () => document.removeEventListener('focusout', onBlur)
  }, [needRefresh, updateServiceWorker, showToast])
}
