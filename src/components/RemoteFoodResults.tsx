import { round } from '../domain/nutrition'
import { useRemoteFoodSearch } from '../hooks/useRemoteFoodSearch'
import type { FoundFood } from '../services/foodSearch'

/**
 * Open Food Facts matches, shown under the user's own library.
 *
 * Own foods come first deliberately: they are curated and trusted, whereas
 * these are crowd-sourced and of mixed quality — which is also why a record
 * with no usable energy value is labelled rather than quietly logged as zero.
 */
export default function RemoteFoodResults({
  query,
  onPick,
  enabled = true,
}: {
  query: string
  onPick: (product: FoundFood) => void
  enabled?: boolean
}) {
  const { results, loading, error, partial } = useRemoteFoodSearch(query, enabled)

  if (!enabled || query.trim().length < 2) return null

  return (
    <section className="mt-5">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide muted">
        Food database
        {loading && (
          <span
            aria-label="Searching"
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
      </h3>

      {partial && results.length > 0 && (
        <p className="mb-2 text-xs muted">
          One of the two databases did not answer, so this list may be short. Searching again
          usually fills it in.
        </p>
      )}

      {error && results.length === 0 ? (
        <p className="card px-4 py-4 text-center text-sm muted">
          {error === 'rate-limited'
            ? 'The food databases are busy. Try that search again shortly.'
            : 'Could not reach the food databases. Your own foods are unaffected.'}
        </p>
      ) : results.length === 0 && !loading ? (
        <p className="card px-4 py-4 text-center text-sm muted">
          No products matched. You can still add the food yourself.
        </p>
      ) : (
        <ul className="card divide-y overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {results.map((product) => (
            <li key={product.key} style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={() => onPick(product)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--track)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {product.name}
                    {product.brand && <span className="muted"> · {product.brand}</span>}
                  </span>
                  <span className="block truncate text-xs muted">
                    {product.incomplete
                      ? 'No energy data — check the label before logging'
                      : `${Math.round(product.per100g.kcal)} kcal · C ${round(product.per100g.carbs)}g · P ${round(product.per100g.protein)}g · F ${round(product.per100g.fat)}g per 100 g`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
