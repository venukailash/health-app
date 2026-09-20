import { toDateKey } from '../domain/date'
import { recipePerServing, scaleNutrients } from '../domain/nutrition'
import type { Food, LogEntry, MealType, Nutrients, Recipe, Serving } from '../domain/types'

/**
 * Impure construction (ids, timestamps) lives here so the reducer itself
 * stays a pure function of (state, action) and is trivially testable.
 */

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export interface FoodDraft {
  name: string
  brand?: string
  category?: string
  per100g: Nutrients
  defaultServing?: Serving
}

export function createFood(draft: FoodDraft): Food {
  return {
    id: newId(),
    name: draft.name.trim(),
    ...(draft.brand?.trim() ? { brand: draft.brand.trim() } : {}),
    ...(draft.category?.trim() ? { category: draft.category.trim() } : {}),
    per100g: draft.per100g,
    ...(draft.defaultServing ? { defaultServing: draft.defaultServing } : {}),
    source: 'user',
    createdAt: new Date().toISOString(),
  }
}

/** Copy a read-only seed food into an editable user food. */
export function duplicateFood(food: Food): Food {
  return createFood({
    name: `${food.name} (copy)`,
    brand: food.brand,
    category: food.category,
    per100g: { ...food.per100g },
    defaultServing: food.defaultServing ? { ...food.defaultServing } : undefined,
  })
}

export interface RecipeDraft {
  name: string
  servings: number
  ingredients: Recipe['ingredients']
}

export function createRecipe(draft: RecipeDraft): Recipe {
  return {
    id: newId(),
    name: draft.name.trim(),
    servings: Math.max(1, Math.round(draft.servings)),
    ingredients: draft.ingredients.map((ingredient) => ({ ...ingredient })),
    createdAt: new Date().toISOString(),
  }
}

export function logFood(
  food: Food,
  grams: number,
  meal: MealType,
  date: string = toDateKey(),
): LogEntry {
  return {
    id: newId(),
    date,
    meal,
    ref: { kind: 'food', id: food.id, grams },
    label: food.brand ? `${food.name} (${food.brand})` : food.name,
    nutrients: scaleNutrients(food.per100g, grams),
    loggedAt: new Date().toISOString(),
  }
}

export function logRecipe(
  recipe: Recipe,
  servings: number,
  foodsById: Map<string, Food>,
  meal: MealType,
  date: string = toDateKey(),
): LogEntry {
  const perOne = recipePerServing(recipe, foodsById)
  return {
    id: newId(),
    date,
    meal,
    ref: { kind: 'recipe', id: recipe.id, servings },
    label: recipe.name,
    nutrients: {
      kcal: perOne.kcal * servings,
      fat: perOne.fat * servings,
      satFat: perOne.satFat * servings,
      carbs: perOne.carbs * servings,
      fibre: perOne.fibre * servings,
      protein: perOne.protein * servings,
      salt: perOne.salt * servings,
    },
    loggedAt: new Date().toISOString(),
  }
}
