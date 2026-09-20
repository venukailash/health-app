import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Page from '../components/Page'
import { recipePerServing, roundNutrients } from '../domain/nutrition'
import { useAppState } from '../state/AppStore'
import { foodsById } from '../state/selectors'

export default function RecipesPage() {
  const { recipes, foods } = useAppState()
  const index = useMemo(() => foodsById(foods), [foods])

  const rows = useMemo(
    () =>
      [...recipes]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((recipe) => ({
          recipe,
          perServing: roundNutrients(recipePerServing(recipe, index)),
          missing: recipe.ingredients.filter((ingredient) => !index.has(ingredient.foodId)).length,
        })),
    [recipes, index],
  )

  return (
    <Page
      title="Recipes"
      subtitle={recipes.length === 1 ? '1 recipe' : `${recipes.length} recipes`}
      action={
        <Link
          to="/recipes/new"
          className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          New recipe
        </Link>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          title="No recipes yet"
          description="Build a recipe from foods in your library and log it by the serving — handy for anything you cook more than once."
          action={
            <Link to="/recipes/new" className="text-sm font-semibold text-brand">
              Create your first recipe
            </Link>
          }
        />
      ) : (
        <ul className="card divide-y overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {rows.map(({ recipe, perServing, missing }) => (
            <li key={recipe.id} style={{ borderColor: 'var(--border)' }}>
              <Link
                to={`/recipes/${recipe.id}`}
                className="block px-4 py-3 hover:bg-[var(--track)]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-medium">{recipe.name}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {perServing.kcal} kcal
                    <span className="font-normal muted"> / serving</span>
                  </p>
                </div>
                <p className="truncate text-xs muted">
                  {recipe.ingredients.length}{' '}
                  {recipe.ingredients.length === 1 ? 'ingredient' : 'ingredients'} ·{' '}
                  {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'} · C{' '}
                  {perServing.carbs}g · P {perServing.protein}g · F {perServing.fat}g
                </p>
                {missing > 0 && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-over)' }}>
                    {missing} {missing === 1 ? 'ingredient refers' : 'ingredients refer'} to a
                    deleted food and {missing === 1 ? 'is' : 'are'} not counted.
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
