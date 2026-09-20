/** Macronutrients tracked in slice 1. For a Food these are always per 100 g. */
export interface Nutrients {
  kcal: number
  /** Total fat, grams. */
  fat: number
  /** Saturated fat, grams. Unsaturated fat is derived: fat - satFat. */
  satFat: number
  carbs: number
  /** Fibre, grams. UK labels list this separately from carbohydrate. */
  fibre: number
  protein: number
  /** Salt in grams (UK convention), not sodium in mg. */
  salt: number
}

export const NUTRIENT_KEYS = ['kcal', 'fat', 'satFat', 'carbs', 'fibre', 'protein', 'salt'] as const
export type NutrientKey = (typeof NUTRIENT_KEYS)[number]

/** Macros shown as progress bars on the dashboard, in display order. */
export const MACRO_KEYS = ['carbs', 'fibre', 'protein', 'fat', 'satFat', 'salt'] as const
export type MacroKey = (typeof MACRO_KEYS)[number]

export interface Serving {
  label: string
  grams: number
}

export interface Food {
  id: string
  name: string
  brand?: string
  /** Nutrition per 100 g — the canonical unit for every food. */
  per100g: Nutrients
  /** Optional convenience portion, e.g. { label: '1 slice', grams: 36 }. */
  defaultServing?: Serving
  /** Grouping for the food library list, e.g. 'Dairy & eggs'. */
  category?: string
  /** Set when the food came from a scanned product, so a re-scan finds it. */
  barcode?: string
  source: 'seed' | 'user'
  createdAt: string
}

export interface RecipeIngredient {
  foodId: string
  grams: number
}

export interface Recipe {
  id: string
  name: string
  ingredients: RecipeIngredient[]
  /** How many servings the full recipe yields. Always >= 1. */
  servings: number
  createdAt: string
}

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

export type LogRef =
  | { kind: 'food'; id: string; grams: number }
  | { kind: 'recipe'; id: string; servings: number }

export interface LogEntry {
  id: string
  /** Local calendar date, 'YYYY-MM-DD'. Never derived from toISOString(). */
  date: string
  meal: MealType
  ref: LogRef
  /** Display name frozen at log time, so history survives renames and deletes. */
  label: string
  /** Snapshot of the computed totals for this entry — not a live lookup. */
  nutrients: Nutrients
  loggedAt: string
}

/** Daily targets. Same shape as Nutrients: absolute kcal and grams. */
export type Goals = Nutrients

/** Log entries bucketed by local date key. */
export type LogByDate = Record<string, LogEntry[]>
