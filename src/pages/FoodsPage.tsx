import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Page from '../components/Page'
import { round } from '../domain/nutrition'
import { groupByCategory, matchesQuery } from '../domain/foodSearch'
import { useAppState } from '../state/AppStore'

export default function FoodsPage() {
  const { foods } = useAppState()
  const [query, setQuery] = useState('')
  const [mineOnly, setMineOnly] = useState(false)

  const groups = useMemo(() => {
    const filtered = foods
      .filter((food) => (mineOnly ? food.source === 'user' : true))
      .filter((food) => matchesQuery(food, query))
      .sort((a, b) => a.name.localeCompare(b.name))
    return groupByCategory(filtered)
  }, [foods, query, mineOnly])

  const total = groups.reduce((count, [, items]) => count + items.length, 0)

  return (
    <Page
      title="Foods"
      subtitle={`${foods.length} in your library`}
      action={
        <Link
          to="/foods/new"
          className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
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
        <button
          type="button"
          onClick={() => setMineOnly((value) => !value)}
          aria-pressed={mineOnly}
          className={`shrink-0 rounded-xl border px-3 text-sm font-medium ${
            mineOnly ? 'bg-brand text-white' : 'card'
          }`}
          style={mineOnly ? { borderColor: 'transparent' } : undefined}
        >
          Mine
        </button>
      </div>

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
          {groups.map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide muted">
                {category}
              </h2>
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
    </Page>
  )
}
