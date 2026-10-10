import type { Nutrients, Serving } from '../domain/types'
import { ZERO_NUTRIENTS, round } from '../domain/nutrition'
import { LookupFailedError, RateLimitedError } from './openFoodFacts'

/**
 * Estimate nutrition from a photo, using Google's Gemini API.
 *
 * Everything this returns is a GUESS. A model looking at a picture cannot know
 * what is in a dish, how it was cooked, or how much oil went in — so the
 * result is always shown for review before anything is saved, and is labelled
 * as an estimate wherever it appears. It is a faster starting point than
 * typing a label in, not a substitute for one.
 *
 * The API is called straight from the browser, which Google's CORS headers
 * allow. That keeps the app a static site, at the cost of the key living on
 * the device — see `docs/DECISIONS.md` for why that is an accepted trade here
 * and what to do about it.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Cheapest model that can read an image.
 *
 * The `-latest` alias, not a pinned version, and that is the whole point:
 * a pinned `gemini-2.5-flash-lite` was rejected with "no longer available to
 * new users" within weeks of being current. Google retires names faster than
 * a hard-coded default survives, and the alias always resolves to whatever
 * the cheapest lite model is today.
 *
 * Still configurable, and a 404 names the offending model so a future
 * breakage is self-explanatory rather than mysterious.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest'

/** Keep the request small: large photos cost more and add nothing. */
const MAX_IMAGE_EDGE = 1024
const JPEG_QUALITY = 0.8

export class MissingKeyError extends Error {
  constructor() {
    super('Add a Gemini API key in Settings to estimate nutrition from a photo.')
    this.name = 'MissingKeyError'
  }
}

export class ModelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelError'
  }
}

export interface PhotoEstimate {
  name: string
  /** What the model thinks a normal helping of this is. */
  defaultServing?: Serving
  per100g: Nutrients
  /** The model's own confidence, which it is asked for explicitly. */
  confidence: 'low' | 'medium' | 'high'
  /** Anything it could not tell from the picture. */
  caveat?: string
}

/**
 * Downscale and re-encode before sending.
 *
 * A modern phone photo is several megabytes and tokens are charged by image
 * size; nothing in a nutrition estimate needs more than about a thousand
 * pixels on the long edge.
 */
export async function prepareImage(file: File): Promise<{ data: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new LookupFailedError('Could not read that image.')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  return { data: dataUrl.split(',')[1] ?? '', mimeType: 'image/jpeg' }
}

const PROMPT = `You are helping log food in a nutrition tracker that follows UK food labelling.

Look at the photo and identify the food. Then estimate its nutrition PER 100 GRAMS.

Rules:
- Carbohydrate EXCLUDES fibre (UK convention). Report fibre separately.
- Report salt in grams, not sodium.
- Energy in kilocalories.
- If several foods are on the plate, describe the whole plate as one item and estimate for the combination.
- servingGrams is your estimate of the weight of the portion actually shown in the photo.
- Be honest in "confidence". Use "low" when the photo is ambiguous, the dish could have been cooked many ways, or the portion is hard to judge.
- Put anything you genuinely cannot tell from the photo in "caveat", briefly. Use null if there is nothing worth saying.
- If the photo contains no food at all, set name to "" and confidence to "low".

Reply with ONLY a JSON object, no markdown fence, in exactly this shape:
{"name":string,"servingLabel":string,"servingGrams":number,"per100g":{"kcal":number,"fat":number,"satFat":number,"carbs":number,"fibre":number,"protein":number,"salt":number},"confidence":"low"|"medium"|"high","caveat":string|null}`

const asNumber = (value: unknown): number => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

/** Pull the JSON out of a reply that may still be wrapped in a code fence. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fenced ? fenced[1] : text).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return null
  }
}

export function toEstimate(value: unknown): PhotoEstimate | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>

  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (name === '') return null

  const per100gRaw = (raw.per100g ?? {}) as Record<string, unknown>
  const per100g: Nutrients = {
    ...ZERO_NUTRIENTS,
    kcal: Math.round(asNumber(per100gRaw.kcal)),
    fat: round(asNumber(per100gRaw.fat), 1),
    satFat: round(asNumber(per100gRaw.satFat), 1),
    carbs: round(asNumber(per100gRaw.carbs), 1),
    fibre: round(asNumber(per100gRaw.fibre), 1),
    protein: round(asNumber(per100gRaw.protein), 1),
    salt: round(asNumber(per100gRaw.salt), 2),
  }
  // The model gets this wrong often enough to be worth clamping rather than
  // importing something that fails the app's own validation.
  if (per100g.satFat > per100g.fat) per100g.satFat = per100g.fat

  const servingGrams = asNumber(raw.servingGrams)
  const servingLabel = typeof raw.servingLabel === 'string' ? raw.servingLabel.trim() : ''

  const confidence =
    raw.confidence === 'high' || raw.confidence === 'medium' ? raw.confidence : 'low'

  return {
    name,
    per100g,
    defaultServing:
      servingGrams > 0
        ? { label: servingLabel || `${round(servingGrams, 0)} g portion`, grams: round(servingGrams, 1) }
        : undefined,
    confidence,
    caveat: typeof raw.caveat === 'string' && raw.caveat.trim() !== '' ? raw.caveat.trim() : undefined,
  }
}

/* ------------------------------------------------------------------ */
/* Recipes described in words                                           */
/* ------------------------------------------------------------------ */

export interface EstimatedIngredient {
  name: string
  grams: number
  per100g: Nutrients
}

export interface RecipeEstimate {
  name: string
  servings: number
  ingredients: EstimatedIngredient[]
  confidence: 'low' | 'medium' | 'high'
  caveat?: string
}

const RECIPE_PROMPT = `You convert a described recipe into ingredients for a nutrition tracker that follows UK food labelling.

The user writes something like "28g coffee beans in a moka pot + 200g whole milk, serves 2".

Rules:
- List what actually ENDS UP IN the finished dish, with the weight consumed. Brewed coffee, not the spent grounds; cooked weight where the description implies cooking.
- Give each ingredient's nutrition PER 100 GRAMS, not for the amount used.
- Carbohydrate EXCLUDES fibre (UK convention). Report fibre separately. Salt in grams, not sodium. Energy in kilocalories.
- "serves N" or "makes N" sets servings. Default to 1 if not stated.
- Use plain, generic ingredient names ("whole milk", "chicken breast"), not brand names, so they match a food library.
- Keep weights as stated by the user. Only estimate a weight when none is given.
- Be honest in "confidence", and put anything genuinely ambiguous in "caveat" (null if nothing).
- If the text does not describe food at all, return an empty ingredients array.

Reply with ONLY a JSON object, no markdown fence:
{"name":string,"servings":number,"ingredients":[{"name":string,"grams":number,"per100g":{"kcal":number,"fat":number,"satFat":number,"carbs":number,"fibre":number,"protein":number,"salt":number}}],"confidence":"low"|"medium"|"high","caveat":string|null}`

function toNutrientsBlock(value: unknown): Nutrients {
  const raw = (value ?? {}) as Record<string, unknown>
  const per100g: Nutrients = {
    ...ZERO_NUTRIENTS,
    kcal: Math.round(asNumber(raw.kcal)),
    fat: round(asNumber(raw.fat), 1),
    satFat: round(asNumber(raw.satFat), 1),
    carbs: round(asNumber(raw.carbs), 1),
    fibre: round(asNumber(raw.fibre), 1),
    protein: round(asNumber(raw.protein), 1),
    salt: round(asNumber(raw.salt), 2),
  }
  if (per100g.satFat > per100g.fat) per100g.satFat = per100g.fat
  return per100g
}

export function toRecipeEstimate(value: unknown): RecipeEstimate | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>

  const rawIngredients = Array.isArray(raw.ingredients) ? raw.ingredients : []
  const ingredients = rawIngredients.flatMap((entry): EstimatedIngredient[] => {
    if (typeof entry !== 'object' || entry === null) return []
    const item = entry as Record<string, unknown>
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const grams = asNumber(item.grams)
    // A zero-weight ingredient contributes nothing and only clutters the list.
    if (name === '' || grams <= 0) return []
    return [{ name, grams: round(grams, 1), per100g: toNutrientsBlock(item.per100g) }]
  })

  if (ingredients.length === 0) return null

  const servings = asNumber(raw.servings)

  return {
    name: typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : 'Recipe',
    servings: servings >= 1 ? Math.round(servings) : 1,
    ingredients,
    confidence: raw.confidence === 'high' || raw.confidence === 'medium' ? raw.confidence : 'low',
    caveat:
      typeof raw.caveat === 'string' && raw.caveat.trim() !== '' ? raw.caveat.trim() : undefined,
  }
}

/** Shared request plumbing for both estimators. */
async function callGemini(
  parts: unknown[],
  { apiKey, model, signal }: { apiKey: string | undefined; model: string; signal?: AbortSignal },
): Promise<string> {
  if (!apiKey || apiKey.trim() === '') throw new MissingKeyError()

  let response: Response
  try {
    response = await fetch(
      `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      },
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new LookupFailedError('Could not reach Gemini. Check your connection.')
  }

  if (response.status === 429) throw new RateLimitedError(Date.now() + 60_000)
  if (response.status === 400 || response.status === 403) {
    throw new ModelError('Gemini rejected the key. Check it in Settings.')
  }
  if (response.status === 404) {
    throw new ModelError(
      `Gemini has no model called "${model}" — it may have been retired. Change it in Settings.`,
    )
  }
  if (!response.ok) throw new LookupFailedError('Gemini returned an error.')

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new LookupFailedError('Gemini returned something unreadable.')
  }

  const text = (payload as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }).candidates?.[0]?.content?.parts?.[0]?.text

  if (typeof text !== 'string') {
    throw new ModelError('Gemini did not return an answer. Try rewording it.')
  }
  return text
}

export async function estimateRecipeFromText(
  description: string,
  {
    apiKey,
    model = DEFAULT_GEMINI_MODEL,
    signal,
  }: { apiKey: string | undefined; model?: string; signal?: AbortSignal },
): Promise<RecipeEstimate> {
  const text = description.trim()
  if (text === '') throw new ModelError('Describe the recipe first.')

  const reply = await callGemini([{ text: RECIPE_PROMPT }, { text: `Recipe: ${text}` }], {
    apiKey,
    model,
    signal,
  })

  const estimate = toRecipeEstimate(extractJson(reply))
  if (!estimate) throw new ModelError('No ingredients could be read from that description.')
  return estimate
}

export async function estimateFromPhoto(
  file: File,
  {
    apiKey,
    model = DEFAULT_GEMINI_MODEL,
    signal,
  }: { apiKey: string | undefined; model?: string; signal?: AbortSignal },
): Promise<PhotoEstimate> {
  if (!apiKey || apiKey.trim() === '') throw new MissingKeyError()

  const image = await prepareImage(file)

  let response: Response
  try {
    response = await fetch(
      `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: image.mimeType, data: image.data } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
          },
        }),
      },
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new LookupFailedError('Could not reach Gemini. Check your connection.')
  }

  if (response.status === 429) throw new RateLimitedError(Date.now() + 60_000)
  if (response.status === 400 || response.status === 403) {
    throw new ModelError('Gemini rejected the key. Check it in Settings.')
  }
  if (response.status === 404) {
    throw new ModelError(
      `Gemini has no model called "${model}" — it may have been retired. Change it in Settings.`,
    )
  }
  if (!response.ok) throw new LookupFailedError('Gemini returned an error.')

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new LookupFailedError('Gemini returned something unreadable.')
  }

  const text = (payload as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }).candidates?.[0]?.content?.parts?.[0]?.text

  if (typeof text !== 'string') {
    throw new ModelError('Gemini did not return an answer. Try a clearer photo.')
  }

  const estimate = toEstimate(extractJson(text))
  if (!estimate) {
    throw new ModelError('No food could be identified in that photo.')
  }
  return estimate
}
