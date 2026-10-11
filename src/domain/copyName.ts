/**
 * A name for a copy that does not collide with anything already there.
 *
 * "Dhal" becomes "Dhal (copy)", then "Dhal (copy 2)" if that is taken. A copy
 * of a copy strips the old suffix first, so a shelf of variations reads
 * "Dhal (copy 2)", "Dhal (copy 3)" rather than "Dhal (copy) (copy)".
 */

const COPY_SUFFIX = /\s*\(copy(?:\s+\d+)?\)\s*$/i

export function baseName(name: string): string {
  return name.replace(COPY_SUFFIX, '').trim()
}

export function copyName(name: string, taken: Iterable<string>): string {
  const base = baseName(name) || name.trim()
  const used = new Set([...taken].map((entry) => entry.trim().toLowerCase()))

  const first = `${base} (copy)`
  if (!used.has(first.toLowerCase())) return first

  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base} (copy ${n})`
    if (!used.has(candidate.toLowerCase())) return candidate
  }

  // A thousand copies of one recipe is not a case worth a cleverer answer.
  return `${base} (copy)`
}
