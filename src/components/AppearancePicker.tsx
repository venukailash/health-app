import { COLOR_MODES, DEFAULT_COLOR_MODE, DEFAULT_THEME, THEMES } from '../domain/themes'
import { useAppState, useDispatch } from '../state/AppStore'

/**
 * Theme and light/dark choice.
 *
 * Each swatch is drawn with the theme's own tokens rather than a picture of
 * them, by scoping `data-theme` to the swatch itself — so a swatch cannot
 * drift from what choosing it actually does.
 */
export default function AppearancePicker() {
  const state = useAppState()
  const dispatch = useDispatch()
  const theme = state.meta.theme ?? DEFAULT_THEME
  const mode = state.meta.colorMode ?? DEFAULT_COLOR_MODE

  const setMeta = (patch: Partial<typeof state.meta>) =>
    dispatch({ type: 'meta/set', meta: { ...state.meta, ...patch } })

  return (
    <section className="card mb-4 p-4">
      <h2 className="mb-1 font-semibold">Appearance</h2>
      <p className="mb-4 text-sm muted">
        Changes apply straight away and are kept on this device.
      </p>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-medium">Mode</legend>
        <div className="flex gap-2">
          {COLOR_MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={mode === option.id}
              onClick={() =>
                setMeta({
                  colorMode: option.id === DEFAULT_COLOR_MODE ? undefined : option.id,
                })
              }
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${
                mode === option.id ? 'bg-brand text-brand-ink' : ''
              }`}
              style={{ borderColor: 'var(--border)' }}
            >
              {option.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs muted">
          System follows your phone or laptop, including its light and dark schedule.
        </p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Theme</legend>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((option) => {
            const selected = theme === option.id
            return (
              <button
                key={option.id}
                type="button"
                data-theme={option.id}
                aria-pressed={selected}
                aria-label={`${option.name} theme`}
                onClick={() => setMeta({ theme: option.id === DEFAULT_THEME ? undefined : option.id })}
                className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left"
                style={{
                  // `data-theme` on the button re-resolves every token from
                  // that theme's values, in whichever mode is live, so a
                  // swatch cannot drift from what picking it does.
                  background: 'var(--surface-raised)',
                  borderColor: selected ? 'var(--color-brand)' : 'var(--border)',
                  borderWidth: selected ? 2 : 1,
                  color: 'var(--text)',
                }}
              >
                <span className="flex shrink-0 gap-1" aria-hidden="true">
                  {['--color-brand', '--color-kcal', '--heat-2'].map((token) => (
                    <span
                      key={token}
                      className="h-5 w-2.5 rounded-full"
                      style={{ background: `var(${token})` }}
                    />
                  ))}
                </span>
                <span className="text-sm font-semibold">{option.name}</span>
                {selected && (
                  <span className="ml-auto text-xs" style={{ color: 'var(--color-brand)' }}>
                    ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </fieldset>
    </section>
  )
}
