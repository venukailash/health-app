import { useState } from 'react'
import Page from '../components/Page'
import Button from '../components/Button'
import { useToast } from '../state/ToastProvider'

/**
 * How to get Apple Health steps into the app.
 *
 * There is no way around the Shortcut. A PWA has no access to HealthKit —
 * that is an Apple platform restriction with no web API, not something the app
 * can work around — so the data has to be pushed in from outside. Shortcuts
 * can read Health and open a URL, which is the whole mechanism.
 */
export default function ActivitySetupPage() {
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)

  const base = `${window.location.origin}${window.location.pathname}#/activity/import?days=`

  async function copyBase() {
    try {
      await navigator.clipboard.writeText(base)
      setCopied(true)
      showToast('Link copied.', { tone: 'success' })
    } catch {
      showToast('Could not copy — select the text and copy it by hand.', { tone: 'error' })
    }
  }

  return (
    <Page title="Bring in steps" subtitle="From Apple Health, using Shortcuts" backTo="/activity">
      <section className="card mb-4 p-4">
        <h2 className="mb-2 font-semibold">Why a Shortcut is needed</h2>
        <p className="text-sm muted">
          This app runs in the browser, and browsers have no access to Apple Health — there is no
          web API for it. Shortcuts can read Health and open a link, so the Shortcut reads your step
          count and hands it to the app through the address bar. Nothing is uploaded anywhere; the
          numbers go straight into this browser&apos;s storage.
        </p>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold">1. Copy your import link</h2>
        <p className="mb-3 text-sm muted">You will paste this into the Shortcut in step 2.</p>
        <code
          className="mb-3 block overflow-x-auto rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--track)' }}
        >
          {base}
        </code>
        <Button onClick={copyBase} variant={copied ? 'secondary' : 'primary'}>
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-semibold">2. Build the Shortcut</h2>
        <p className="mb-3 text-sm muted">
          In the Shortcuts app, tap <strong>+</strong> to make a new shortcut and add these actions
          in order. Search each name in the action list.
        </p>

        <ol className="space-y-3 text-sm">
          {[
            {
              action: 'Find Health Samples',
              detail:
                'Set Type to Steps. Add a filter: Start Date is Today. Set "Sort by" to Start Date. This collects today’s step samples.',
            },
            {
              action: 'Calculate Statistics',
              detail:
                'Set it to Sum over the Health Samples from the previous step. Health stores steps as many small samples, so they have to be added up.',
            },
            {
              action: 'Format Date',
              detail:
                'Pass in Current Date. Choose Custom format and enter exactly yyyy-MM-dd. The app needs the date in that form.',
            },
            {
              action: 'Text',
              detail:
                'Paste your import link, then append the Formatted Date, a colon, and the Statistics result — so it ends …?days=2026-09-20:8421',
            },
            {
              action: 'Open URLs',
              detail:
                'Pass in the Text. This opens the app and imports the count. It will bounce straight back to the Activity screen.',
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

      <section className="card mb-4 p-4">
        <h2 className="mb-2 font-semibold">3. Run it daily, if you like</h2>
        <p className="text-sm muted">
          In the Shortcuts app go to <strong>Automation</strong> → <strong>+</strong> →{' '}
          <strong>Time of Day</strong>, pick something late like 23:45, and choose your shortcut.
          Turn off &ldquo;Ask Before Running&rdquo; so it does not prompt you.
        </p>
        <p className="mt-2 text-sm muted">
          Be aware that this opens the app each time it runs — that is how the data gets in, and
          iOS gives no quieter route. If that is intrusive, leave it manual and run the shortcut
          when you want to catch up.
        </p>
      </section>

      <section className="card p-4">
        <h2 className="mb-2 font-semibold">Backfilling several days</h2>
        <p className="mb-3 text-sm muted">
          The link accepts more than one day at a time, separated by commas. Handy when you have
          been away from the app for a while:
        </p>
        <code
          className="block overflow-x-auto rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--track)' }}
        >
          …?days=2026-09-20:8421,2026-09-19:10233,2026-09-18:4102
        </code>
        <p className="mt-3 text-sm muted">
          Anything unreadable is reported rather than skipped silently, so a Shortcut sending the
          wrong Health type will tell you rather than appearing to do nothing.
        </p>
      </section>
    </Page>
  )
}
