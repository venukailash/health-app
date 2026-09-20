import type { Food, Nutrients, Recipe, RecipeIngredient } from './types'
import { NUTRIENT_KEYS } from './types'

export const ZERO_NUTRIENTS: Nutrients = {
  kcal: 0,
  fat: 0,
  satFat: 0,
  carbs: 0,
  protein: 0,
  salt: 0,
}

/** Round to `dp` decimal places, avoiding float dust like 0.30000000000000004. */
export function round(value: number, dp = 1): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** dp
  return Math.round(value * factor) / factor
}

/** Display rounding: kcal to whole numbers, grams to one decimal place. */
export function roundNutrients(n: Nutrients): Nutrients {
  return {
    kcal: Math.round(n.kcal),
    fat: round(n.fat),
    satFat: round(n.satFat),
    carbs: round(n.carbs),
    protein: round(n.protein),
    salt: round(n.salt, 2),
  }
}

/** Scale per-100 g values to an arbitrary gram weight. */
export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  const factor = Number.isFinite(grams) ? grams / 100 : 0
  return multiplyNutrients(per100g, factor)
}

export function multiplyNutrients(n: Nutrients, factor: number): Nutrients {
  const safe = Number.isFinite(factor) ? factor : 0
  const out = { ...ZERO_NUTRIENTS }
  for (const key of NUTRIENT_KEYS) out[key] = (n[key] ?? 0) * safe
  return out
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  const out = { ...ZERO_NUTRIENTS }
  for (const key of NUTRIENT_KEYS) out[key] = (a[key] ?? 0) + (b[key] ?? 0)
  return out
}

export function sumNutrients(items: Nutrients[]): Nutrients {
  return items.reduce(addNutrients, ZERO_NUTRIENTS)
}

/**
 * Unsaturated fat is derived rather than stored, so the parts can never
 * disagree with the whole. Guards against data where satFat > fat.
 */
export function unsaturatedFat(n: Pick<Nutrients, 'fat' | 'satFat'>): number {
  return Math.max(0, (n.fat ?? 0) - (n.satFat ?? 0))
}

/** Total nutrition for a whole recipe. Ingredients with a missing food are skipped. */
export function recipeTotals(
  ingredients: RecipeIngredient[],
  foodsById: Map<string, Food> | Record<string, Food>,
): Nutrients {
  const lookup = (id: string): Food | undefined =>
    foodsById instanceof Map ? foodsById.get(id) : foodsById[id]

  return sumNutrients(
    ingredients.flatMap((ingredient) => {
      const food = lookup(ingredient.foodId)
      return food ? [scaleNutrients(food.per100g, ingredient.grams)] : []
    }),
  )
}

/** Nutrition for one serving of a recipe. */
export function perServing(totals: Nutrients, servings: number): Nutrients {
  if (!Number.isFinite(servings) || servings <= 0) return { ...ZERO_NUTRIENTS }
  return multiplyNutrients(totals, 1 / servings)
}

export function recipePerServing(
  recipe: Pick<Recipe, 'ingredients' | 'servings'>,
  foodsById: Map<string, Food> | Record<string, Food>,
): Nutrients {
  return perServing(recipeTotals(recipe.ingredients, foodsById), recipe.servings)
}

/**
 * Percentage of a daily target consumed. Uncapped — going over goal is
 * meaningful information, so callers clamp only the bar width, not the number.
 * A zero or missing target yields 0 rather than Infinity.
 */
export function percentOfGoal(consumed: number, target: number): number {
  if (!Number.isFinite(target) || target <= 0) return 0
  if (!Number.isFinite(consumed)) return 0
  return round((consumed / target) * 100, 0)
}

/** Energy from macros, for sanity-checking hand-entered foods (Atwater factors). */
export function kcalFromMacros(n: Pick<Nutrients, 'fat' | 'carbs' | 'protein'>): number {
  return round((n.fat ?? 0) * 9 + (n.carbs ?? 0) * 4 + (n.protein ?? 0) * 4, 0)
}
