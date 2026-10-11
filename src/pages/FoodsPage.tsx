import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import ScanButton from '../components/ScanButton'
import RemoteFoodResults from '../components/RemoteFoodResults'
import { useBarcodeLookup } from '../hooks/useBarcodeLookup'
import { toFood as searchedToFood, type FoundFood } from '../services/foodSearch'
import { useDispatch } from '../state/AppStore'
import { newId } from '../state/factories'
import EmptyState from '../components/EmptyState'
import FilterChips from '../components/FilterChips'
import Page from '../components/Page'
import { round } from '../domain/nutrition'
import { byMineThenName, groupByCategory, matchesQuery } from '../domain/foodSearch'
import { useAppState } from '../state/AppStore'

export default function FoodsPage() {
  const { foods } = useAppState()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { lookup } = useBarcodeLookup()
  const [query, setQuery] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  /**
   * Returns whether the code led anywhere, which is what keeps the camera
   * open on a miss. Closing it to show a toast means opening it again to
   * try — the whole job twice, usually because the wrong thing was read.
   */
  async function handleScan(barcode: string): Promise<boolean> {
    const food = await lookup(barcode)
    if (!food) return false
    setScanning(false)
    // Straight into the editor so the values can be checked against the packet.
    navigate(`/foods/${food.id}`)
    return true
  }

  function adoptProduct(product: FoundFood) {
    // Barcode is the strongest match; fall back to name and brand so a repeat
    // search does not create duplicates.
    const existing = foods.find((food) =>
      product.barcode
        ? food.barcode === product.barcode
        : food.name === product.name && (food.brand ?? '') === (product.brand ?? ''),
    )
    if (existing) {
      navigate(`/foods/${existing.id}`)
      return
    }
    const food = searchedToFood(product, newId(), new Date().toISOString())
    dispatch({ type: 'food/add', food })
    navigate(`/foods/${food.id}`)
  }

  // Categories come from what is actually in view, so the row never offers a
  // section that would turn up empty.
  const inScope = useMemo(
    () =>
      foods
        .filter((food) => (mineOnly ? food.source === 'user' : true))
        .filter((food) => matchesQuery(food, query)),
    [foods, query, mineOnly],
  )

  const categories = useMemo(
    () => groupByCategory(inScope).map(([name]) => name),
    [inScope],
  )

  /**
   * A chosen category that the search has since filtered away falls back to
   * All, rather than leaving an empty list for a reason that is not on screen.
   * Derived rather than corrected with setState, so there is no render that
   * shows the wrong thing first.
   */
  const activeCategory = category && categories.includes(category) ? category : null

  const groups = useMemo(() => {
    const filtered = inScope
      .filter(
        (food) => (activeCategory ? (food.category?.trim() || 'Other') === activeCategory : true),
      )
      .sort(byMineThenName)
    return groupByCategory(filtered)
  }, [inScope, activeCategory])

  const total = groups.reduce((count, [, items]) => count + items.length, 0)

  return (
    <Page
      title="Foods"
      subtitle={`${foods.length} in your library`}
      action={
        <Link
          to="/foods/new"
          className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-brand-ink hover:opacity-90"
        >
          New food
        </Link>
      }
    >
      <div className="mb-3 flex gap-2">
        <input
          className="field"
          type="search"
          placeholder="Search foods"
          aria-label="Search foods"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ScanButton compact onClick={() => setScanning(true)} />
        <button
          type="button"
          onClick={() => setMineOnly((value) => !value)}
          aria-pressed={mineOnly}
          className={`shrink-0 rounded-xl border px-3 text-sm font-medium ${
            mineOnly ? 'bg-brand text-brand-ink' : 'card'
          }`}
          style={mineOnly ? { borderColor: 'transparent' } : undefined}
        >
          Mine
        </button>
      </div>

      {categories.length > 1 && (
        <FilterChips
          label="Filter foods by category"
          value={activeCategory}
          onChange={setCategory}
          options={[
            { value: null, label: 'All' },
            ...categories.map((name) => ({ value: name, label: name })),
          ]}
        />
      )}

      {total === 0 ? (
        <EmptyState
          title="No foods found"
          description={
            mineOnly
              ? 'You have not added any foods of your own yet.'
              : 'Try a different search, or add the food yourself.'
          }
          action={
            <Link to="/foods/new" className="text-sm font-semibold text-brand">
              Add a food
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map(([heading, items]) => (
            <section key={heading}>
              {!activeCategory && (
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide muted">
                  {heading}
                </h2>
              )}
              <ul className="card divide-y overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                {items.map((food) => (
                  <li key={food.id} style={{ borderColor: 'var(--border)' }}>
                    <Link
                      to={`/foods/${food.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--track)]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {food.name}
                          {food.brand && <span className="muted"> · {food.brand}</span>}
                        </p>
                        <p className="truncate text-xs muted">
                          {Math.round(food.per100g.kcal)} kcal · C {round(food.per100g.carbs)}g · P{' '}
                          {round(food.per100g.protein)}g · F {round(food.per100g.fat)}g per 100 g
                        </p>
                      </div>
                      {food.source === 'user' && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand"
                          style={{ background: 'var(--track)' }}
                        >
                          Mine
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {!mineOnly && <RemoteFoodResults query={query} onPick={adoptProduct} />}

      {scanning && (
        <BarcodeScanner onDetected={handleScan} onCancel={() => setScanning(false)} />
      )}
    </Page>
  )
}
