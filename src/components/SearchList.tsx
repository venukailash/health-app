import { useMemo, useState } from 'react'

export interface SearchItem {
  id: string
  name: string
  /** Second line, e.g. the per-100 g macro summary. */
  detail?: string
  /** Extra text that should match the query without being displayed. */
  keywords?: string
  badge?: string
}

export function filterItems(items: SearchItem[], query: string): SearchItem[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return items
  return items.filter((item) =>
    `${item.name} ${item.keywords ?? ''}`.toLowerCase().includes(needle),
  )
}

/** Search box over a flat list of pickable items. Used for foods and recipes. */
export default function SearchList({
  items,
  onSelect,
  placeholder = 'Search',
  emptyMessage = 'Nothing matches that search.',
  limit = 60,
  autoFocus,
}: {
  items: SearchItem[]
  onSelect: (id: string) => void
  placeholder?: string
  emptyMessage?: string
  limit?: number
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => filterItems(items, query), [items, query])
  const shown = matches.slice(0, limit)

  return (
    <div>
      <input
        className="field mb-3"
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        value={query}
        autoFocus={autoFocus}
        onChange={(event) => setQuery(event.target.value)}
      />

      {shown.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm muted">{emptyMessage}</p>
      ) : (
        <ul className="card divide-y overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {shown.map((item) => (
            <li key={item.id} style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--track)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.name}</span>
                  {item.detail && <span className="block truncate text-xs muted">{item.detail}</span>}
                </span>
                {item.badge && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand"
                    style={{ background: 'var(--track)' }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {matches.length > shown.length && (
        <p className="mt-2 text-center text-xs muted">
          Showing {shown.length} of {matches.length} — keep typing to narrow it down.
        </p>
      )}
    </div>
  )
}
