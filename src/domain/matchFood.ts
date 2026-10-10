import type { Food } from './types'

/**
 * Find a food already in the library that an ingredient name refers to.
 *
 * Worth doing before creating anything: a described recipe mentioning "whole
 * milk" should reuse the curated starter food rather than add a near-duplicate
 * carrying a model's guess at its nutrition. The library's figures are better
 * than an estimate, and the library stays tidy.
 *
 * Deliberately conservative — a wrong match silently logs the wrong food,
 * which is worse than creating a duplicate the user can see and merge.
 */

export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(fresh|raw|whole|plain|organic|semi)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Crude singular form: enough for "eggs" -> "egg", "tomatoes" -> "tomato". */
function singular(word: string): string {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`
  if (word.endsWith('oes') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1)
  return word
}

function tokens(name: string): string[] {
  return normaliseName(name).split(' ').filter(Boolean).map(singular)
}

export function findMatchingFood(name: string, foods: Food[]): Food | undefined {
  const wanted = tokens(name)
  if (wanted.length === 0) return undefined
  const wantedKey = wanted.join(' ')

  let best: { food: Food; score: number } | undefined

  for (const food of foods) {
    const candidate = tokens(food.name)
    if (candidate.length === 0) continue
    const candidateKey = candidate.join(' ')

    let score = 0
    if (candidateKey === wantedKey) {
      score = 100
    } else {
      const shared = wanted.filter((word) => candidate.includes(word)).length
      // Every word of one must appear in the other: "milk" matches "whole
      // milk", but "coffee" must not match "coffee cake".
      const covered = shared === wanted.length || shared === candidate.length
      if (!covered || shared === 0) continue
      // Prefer the closest length, so "milk" picks "Whole milk" over
      // "Milk chocolate".
      score = 50 + shared * 5 - Math.abs(candidate.length - wanted.length)
    }

    // A food the user made beats a starter food on an equal score.
    if (!best || score > best.score || (score === best.score && food.source === 'user')) {
      best = { food, score }
    }
  }

  return best?.food
}
