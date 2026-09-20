import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import Page from '../components/Page'
import { useStandalone } from '../hooks/useStandalone'
import { useAppState, useDispatch } from '../state/AppStore'
import { useToast } from '../state/ToastProvider'

/**
 * The shared Shortcut, published to iCloud. Importing it is one tap and skips
 * the five-action build entirely, so it is offered first — with the manual
 * steps kept as a fallback, since an iCloud link can be revoked or expire and
 * there would otherwise be no way back.
 */
const SHORTCUT_ICLOUD_LINK = 'https://www.icloud.com/shortcuts/cee4b743f4b3428a9677421fb3a642cc'

/** The name the shared Shortcut arrives with; used to pre-fill the Run button. */
const DEFAULT_SHORTCUT_NAME = 'Copy to Clipboard'

/**
 * How to get Apple Health steps into the app, and why it takes two steps.
 *
 * A PWA cannot read HealthKit — no web API exists — so the data has to come
 * from outside, and Shortcuts is the only thing on iOS that can read Health
 * and hand data over. The awkward part is the handover: an installed web app
 * has its own storage partition, so a link opened from Shortcuts lands in
 * Safari's copy of the app, not this one. The clipboard crosses that boundary;
 * a URL does not.
 */
export default function ActivitySetupPage() {
  const { showToast } = useToast()
  const { meta } = useAppState()
  const dispatch = useDispatch()
  const standalone = useStandalone()
  const [copied, setCopied] = useState(false)
  const [shortcutName, setShortcutName] = useState(meta.shortcutName ?? DEFAULT_SHORTCUT_NAME)

  const linkBase = `${window.location.origin}${window.location.pathname}#/activity/import?days=`

  const [showManual, setShowManual] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(linkBase)
      setCopied(true)
      showToast('Link copied.', { tone: 'success' })
    } catch {
      showToast('Could not copy — select the text and copy it by hand.', { tone: 'error' })
    }
  }

  return (
    <Page title="Bring in steps" subtitle="From Apple Health, using Shortcuts" backTo="/activity">
      <section className="card mb-4 p-4">
        <h2 className="mb-2 font-semibold">Why this takes two steps</h2>
        <p className="mb-3 text-sm muted">
          Browsers have no access to Apple Health — there is no web API for it — so a Shortcut has
          to read the step count and hand it over.
        </p>
        <p className="text-sm muted">
          The handover cannot be a link. iOS gives an installed Home Screen app its own storage,
          entirely separate from Safari&apos;s, and will not route a link into an installed web
          app. A link from Shortcuts therefore opens Safari and the numbers land in a copy of the
          app you never look at. <strong>The clipboard crosses that boundary; a URL does not.</strong>
        </p>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold">Get the Shortcut</h2>
        <p className="mb-4 text-sm muted">
          Open this on your iPhone and Shortcuts will offer to add it. It reads{' '}
          <em>your</em> Health data on <em>your</em> device — nothing is shared by installing it.
        </p>

        <a
          href={SHORTCUT_ICLOUD_LINK}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Add the Shortcut
        </a>

        <p className="mt-3 text-sm muted">
          It arrives named <strong>{DEFAULT_SHORTCUT_NAME}</strong>. Keep that name, or if you
          rename it, put the new name in the box below so the Run button can find it.
        </p>

        <button
          type="button"
          onClick={() => setShowManual((value) => !value)}
          aria-expanded={showManual}
          className="mt-3 text-sm font-semibold text-brand"
        >
          {showManual ? 'Hide the manual steps' : 'Link not working? Build it by hand'}
        </button>
      </section>

      {showManual && (
      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-semibold">Build the Shortcut by hand</h2>
        <p className="mb-3 text-sm muted">
          In the Shortcuts app, tap <strong>+</strong> and add these actions in order.
        </p>

        <ol className="space-y-3 text-sm">
          {[
            {
              action: 'Find Health Samples',
              detail:
                'Type: Steps. Add a filter: Start Date is Today. This collects today’s step samples.',
            },
            {
              action: 'Calculate Statistics',
              detail:
                'Sum, over the Health Samples from the previous step. Health stores steps as many small samples, so they must be added up.',
            },
            {
              action: 'Format Date',
              detail:
                'Pass in Current Date. Choose Custom and enter exactly yyyy-MM-dd.',
            },
            {
              action: 'Text',
              detail:
                'Formatted Date, then a colon, then the Statistics result — so the whole thing reads 2026-09-20:8421 and nothing else.',
            },
            {
              action: 'Copy to Clipboard',
              detail:
                'Pass in the Text. This is the action that makes it work from the installed app. Do NOT use "Open URLs".',
            },
          ].map((step, index) => (
            <li key={step.action} className="flex gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ background: 'var(--track)' }}
              >
                {index + 1}
              </span>
              <span>
                <strong>{step.action}</strong>
                <span className="block muted">{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-sm muted">
          The first run asks permission to read Health data. Allow it, or the sum comes back empty.
        </p>
      </section>
      )}

      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold">Let the app run it for you</h2>
        <p className="mb-4 text-sm muted">
          The app cannot build the Shortcut — iOS has no way for a web page to create one, and
          shortcut files have to be signed or shared through iCloud. It <em>can</em> launch one
          that already exists. Tell it the name you gave yours and a Run button appears on the
          Activity screen.
        </p>

        <label htmlFor="shortcut-name" className="mb-1 block text-sm font-medium">
          Shortcut name <span className="muted">(exactly as it appears in Shortcuts)</span>
        </label>
        <input
          id="shortcut-name"
          className="field"
          type="text"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={DEFAULT_SHORTCUT_NAME}
          value={shortcutName}
          onChange={(event) => setShortcutName(event.target.value)}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              dispatch({
                type: 'meta/set',
                meta: { ...meta, shortcutName: shortcutName.trim() || undefined },
              })
              showToast(shortcutName.trim() ? 'Saved.' : 'Shortcut name cleared.', {
                tone: 'success',
              })
            }}
          >
            Save name
          </Button>
        </div>
        <p className="mt-2 text-xs muted">
          Once saved, the Activity screen gets a single <strong>Run and import</strong> button. If
          it does nothing, the name does not match — Shortcuts is fussy about it, so copy it
          exactly, including capitals.
        </p>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-2 font-semibold">Then import it</h2>
        <p className="text-sm muted">
          With the name saved above, the{' '}
          <Link to="/activity" className="font-medium text-brand">
            Activity
          </Link>{' '}
          screen shows one <strong>Run and import</strong> button: it opens Shortcuts and pulls the
          counts in when you come back. Safari will usually not let a page read the clipboard
          without a tap, so expect it to ask once — that is the platform, not a fault.
        </p>
        <p className="mt-2 text-sm muted">
          Add the Shortcut to your Home Screen or the Share Sheet to make running it quicker. A
          Time of Day automation works too, though the clipboard can be overwritten by anything you
          copy afterwards — so if you leave it a day or two, run the Shortcut again rather than
          relying on what is still there.
        </p>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-2 font-semibold">Several days at once</h2>
        <p className="mb-3 text-sm muted">
          Counts can be comma-separated, which is worth doing if you have been away from the app:
        </p>
        <code
          className="block overflow-x-auto rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--track)' }}
        >
          2026-09-20:8421,2026-09-19:10233,2026-09-18:4102
        </code>
        <p className="mt-3 text-sm muted">
          Anything unreadable is reported rather than skipped silently, so a Shortcut sending the
          wrong Health type will say so instead of appearing to do nothing.
        </p>
      </section>

      <section className="card p-4">
        <h2 className="mb-2 font-semibold">
          If you use the app in Safari{standalone ? '' : ' — which you are right now'}
        </h2>
        <p className="mb-3 text-sm muted">
          Not installed to the Home Screen? Then there is no storage split and a link works
          normally. Finish the Shortcut with <strong>Open URLs</strong> instead of Copy to
          Clipboard, passing a Text action that starts with this and ends with the date and count:
        </p>
        <code
          className="mb-3 block overflow-x-auto rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--track)' }}
        >
          {linkBase}
        </code>
        <Button onClick={() => void copyLink()} variant={copied ? 'secondary' : 'primary'}>
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <p className="mt-3 text-sm muted">
          Mixing the two is the thing to avoid: steps imported in Safari will not appear in the
          installed app, and the other way round. Pick one and stay there.
        </p>
      </section>
    </Page>
  )
}
