import { useCallback, useState } from 'react'
import {
  LookupFailedError,
  RateLimitedError,
  getProductByBarcode,
  toFood,
  type RemoteProduct,
} from '../services/openFoodFacts'
import { useToast } from '../state/ToastProvider'
import { useDispatch, useAppState } from '../state/AppStore'
import { newId } from '../state/factories'
import type { Food } from '../domain/types'

/**
 * Looks a scanned barcode up and returns it as a food in the user's library.
 *
 * A barcode already in the library resolves locally with no network call at
 * all, which makes re-scanning the same weekly shop instant and keeps us well
 * inside the API's rate limit.
 */
export function useBarcodeLookup() {
  const { showToast } = useToast()
  const dispatch = useDispatch()
  const { foods } = useAppState()
  const [looking, setLooking] = useState(false)

  const lookup = useCallback(
    async (barcode: string): Promise<Food | null> => {
      const code = barcode.replace(/\D/g, '')

      const known = foods.find((food) => food.barcode === code)
      if (known) {
        showToast(`${known.name} is already in your foods.`, { tone: 'info' })
        return known
      }

      setLooking(true)
      try {
        const product: RemoteProduct | null = await getProductByBarcode(code)
        if (!product) {
          showToast('That barcode is not in Open Food Facts. Add it by hand.', { tone: 'error' })
          return null
        }

        const food: Food = { ...toFood(product, newId(), new Date().toISOString()), barcode: code }
        dispatch({ type: 'food/add', food })

        showToast(
          product.incomplete
            ? `Added ${food.name}, but it has no energy data — check the label.`
            : `Added ${food.name} to your foods.`,
          { tone: product.incomplete ? 'error' : 'success' },
        )
        return food
      } catch (error) {
        if (error instanceof RateLimitedError) {
          const seconds = Math.max(1, Math.ceil((error.retryAt - Date.now()) / 1000))
          showToast(`Food database is busy. Scan again in about ${seconds}s.`, { tone: 'error' })
        } else if (error instanceof LookupFailedError) {
          showToast('Could not reach the food database. Check your connection.', { tone: 'error' })
        }
        return null
      } finally {
        setLooking(false)
      }
    },
    [foods, dispatch, showToast],
  )

  return { lookup, looking }
}
