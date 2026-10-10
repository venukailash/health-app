import type { Goals, Nutrients, Serving } from '../domain/types'
import { ZERO_NUTRIENTS, round } from '../domain/nutrition'
import { LookupFailedError, RateLimitedError } from './openFoodFacts'

/**
 * Estimate nutrition from a photo or a description, using Google's Gemini API.
 *
 * Two estimators, each taking either input: `estimateFood` for one item and
 * `estimateRecipe` for something with ingredients. Keeping the input and the
 * target as separate choices is what lets every entry point in the app offer
 * the same two options in the same order.
 *
 * Everything this returns is a GUESS. A model cannot know what is in a dish,
 * how it was cooked, or how much oil went in — so the result is always shown
 * for review before anything is saved, and is labelled as an estimate wherever
 * it appears. It is a faster starting point than typing a label in, not a
 * substitute for one.
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

export interface FoodEstimate {
  name: string
  /** What the model thinks a normal helping of this is. */
  defaultServing?: Serving
  per100g: Nutrients
  /** The model's own confidence, which it is asked for explicitly. */
  confidence: 'low' | 'medium' | 'high'
  /** Anything it could not tell. */
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

const FOOD_PROMPT = `You are helping log food in a nutrition tracker that follows UK food labelling.

Identify the food from the photo or description given. Then estimate its nutrition PER 100 GRAMS.

Rules:
- Carbohydrate EXCLUDES fibre (UK convention). Report fibre separately.
- Report salt in grams, not sodium.
- Energy in kilocalories.
- If several foods are on the plate, describe the whole plate as one item and estimate for the combination.
- servingGrams is your estimate of the weight of one normal portion. If a photo shows a container, a utensil or a hand for scale, use it to judge the size.
- Be honest in "confidence". Use "low" when it is ambiguous, the dish could have been cooked many ways, or the portion is hard to judge.
- Put anything you genuinely cannot tell in "caveat", briefly. Use null if there is nothing worth saying.
- If there is no food at all, set name to "" and confidence to "low".

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

export function toEstimate(value: unknown): FoodEstimate | null {
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

/** Photos, a description, or both — the estimators accept any combination. */
export interface AiInput {
  photos?: File[]
  text?: string
}

/**
 * More than this and the cost climbs without the answer improving — each image
 * is around 1,100 tokens whatever its size.
 */
export const MAX_PHOTOS = 4

/** Build the request parts for whichever input was given. */
async function inputParts(input: AiInput, label: string): Promise<unknown[]> {
  const parts: unknown[] = []
  const photos = (input.photos ?? []).slice(0, MAX_PHOTOS)

  if (input.text && input.text.trim() !== '') {
    parts.push({ text: `${label}: ${input.text.trim()}` })
  }
  if (photos.length > 1) {
    // Without this the model can read a second angle as a second food.
    parts.push({
      text: `The following ${photos.length} photos all show the SAME item — different angles, a label, or something for scale. Treat them together as one.`,
    })
  }
  for (const photo of photos) {
    const image = await prepareImage(photo)
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } })
  }

  if (parts.length === 0) throw new ModelError('Add a photo or a description first.')
  return parts
}

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
  // 401 is what an OAuth-style token gets when the API wants an API key, and
  // it used to fall through to "Gemini returned an error", which sent you
  // looking in the wrong place entirely.
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new ModelError(
      'Gemini rejected that key. Check it in Settings — it should start with "AIza".',
    )
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

export async function estimateRecipe(
  input: AiInput,
  {
    apiKey,
    model = DEFAULT_GEMINI_MODEL,
    signal,
  }: { apiKey: string | undefined; model?: string; signal?: AbortSignal },
): Promise<RecipeEstimate> {
  const parts = await inputParts(input, 'Recipe')
  const reply = await callGemini([{ text: RECIPE_PROMPT }, ...parts], { apiKey, model, signal })

  const estimate = toRecipeEstimate(extractJson(reply))
  if (!estimate) throw new ModelError('No ingredients could be worked out from that.')
  return estimate
}

export async function estimateFood(
  input: AiInput,
  {
    apiKey,
    model = DEFAULT_GEMINI_MODEL,
    signal,
  }: { apiKey: string | undefined; model?: string; signal?: AbortSignal },
): Promise<FoodEstimate> {
  const parts = await inputParts(input, 'Food')
  const reply = await callGemini([{ text: FOOD_PROMPT }, ...parts], { apiKey, model, signal })

  const estimate = toEstimate(extractJson(reply))
  if (!estimate) throw new ModelError('No food could be identified from that.')
  return estimate
}

/**
 * Suggested daily targets from a description of the person.
 *
 * Deliberately a starting point and nothing more. A model cannot weigh anyone,
 * does not know their medical history, and should not be the last word on what
 * someone eats — so the numbers land in the targets form for review, exactly
 * like a food estimate lands in the food editor, and the screen says plainly
 * that it is not medical advice.
 *
 * The safety floors below are enforced HERE, in code, not merely asked for in
 * the prompt. A prompt is a request; a model that ignores it would otherwise
 * hand someone a 900 kcal target.
 */
/**
 * Turns whatever came back from an estimator into something to show a person.
 *
 * Shared so every screen that calls Gemini reports the same failure the same
 * way — the alternative is each caller inventing its own wording for a rate
 * limit.
 */
export function geminiErrorMessage(caught: unknown): string {
  if (
    caught instanceof MissingKeyError ||
    caught instanceof ModelError ||
    caught instanceof LookupFailedError
  ) {
    return caught.message
  }
  if (caught instanceof RateLimitedError) return 'Gemini is rate limiting. Try again in a minute.'
  return 'Something went wrong working that out.'
}

export interface GoalsEstimate {
  goals: Goals
  /** One or two lines on how it got there, shown to the user. */
  rationale: string
  /** Anything it could not tell, or a reason to be careful. */
  caveat?: string
}

/** Below this, a daily target is not something to suggest to anyone. */
export const MIN_SUGGESTED_KCAL = 1200
const MAX_SUGGESTED_KCAL = 5000

const GOALS_PROMPT = `You suggest daily nutrition targets for one adult using a personal meal tracker that follows UK food labelling and UK dietary guidance.

The user describes themselves: some of height, weight, age, sex, activity level and what they are trying to do.

Rules:
- Estimate maintenance energy from what you are given (Mifflin-St Jeor plus an activity factor is fine), then apply a MODERATE adjustment for their stated aim: no more than about 20% below maintenance for weight loss, about 10% above for gain.
- NEVER suggest below ${MIN_SUGGESTED_KCAL} kcal, whatever is asked for. If someone asks for a crash diet, give them a sensible target anyway and say so in "caveat".
- Protein in the range 1.2-2.0 g per kg of body weight. Fibre around 30 g. Salt at most 6 g. Saturated fat at most about a third of total fat.
- Carbohydrate EXCLUDES fibre (UK convention). Energy in kilocalories. Salt in grams, not sodium.
- The macro targets should roughly account for the calorie target: 4 kcal per gram of protein and carbohydrate, 9 per gram of fat.
- Round to something a person would actually type: calories to the nearest 10, grams to whole numbers.
- "rationale" is at most two short sentences in plain English, naming the estimated maintenance figure and the adjustment.
- Put anything you had to assume, or any reason for caution, in "caveat" (null if nothing).
- If the text does not describe a person at all, return null for goals.

Reply with ONLY a JSON object, no markdown fence:
{"goals":{"kcal":number,"fat":number,"satFat":number,"carbs":number,"fibre":number,"protein":number,"salt":number}|null,"rationale":string,"caveat":string|null}`

export function toGoalsEstimate(value: unknown): GoalsEstimate | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  if (typeof raw.goals !== 'object' || raw.goals === null) return null

  const block = raw.goals as Record<string, unknown>
  const kcal = Math.round(asNumber(block.kcal))
  if (kcal < MIN_SUGGESTED_KCAL || kcal > MAX_SUGGESTED_KCAL) return null

  const goals: Goals = {
    kcal,
    fat: Math.round(asNumber(block.fat)),
    satFat: Math.round(asNumber(block.satFat)),
    carbs: Math.round(asNumber(block.carbs)),
    fibre: Math.round(asNumber(block.fibre)),
    protein: Math.round(asNumber(block.protein)),
    salt: round(asNumber(block.salt), 1),
  }
  if (goals.satFat > goals.fat) goals.satFat = goals.fat
  // Every macro must be a positive number: a zero protein target is not a
  // suggestion, it is a parse that went wrong.
  if (Object.values(goals).some((amount) => !Number.isFinite(amount) || amount <= 0)) return null

  const rationale = typeof raw.rationale === 'string' ? raw.rationale.trim() : ''
  const caveat = typeof raw.caveat === 'string' && raw.caveat.trim() ? raw.caveat.trim() : undefined

  return { goals, rationale, caveat }
}

export async function estimateGoals(
  description: string,
  {
    apiKey,
    model = DEFAULT_GEMINI_MODEL,
    signal,
  }: { apiKey: string | undefined; model?: string; signal?: AbortSignal },
): Promise<GoalsEstimate> {
  const reply = await callGemini([{ text: GOALS_PROMPT }, { text: `Person: ${description}` }], {
    apiKey,
    model,
    signal,
  })

  const estimate = toGoalsEstimate(extractJson(reply))
  if (!estimate) {
    throw new ModelError(
      'No sensible targets could be worked out from that. Try adding height, weight, age and how active you are.',
    )
  }
  return estimate
}
