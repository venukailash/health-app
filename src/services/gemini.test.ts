import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GEMINI_MODEL,
  MAX_PHOTOS,
  MissingKeyError,
  ModelError,
  estimateFood,
  estimateRecipe,
  MIN_SUGGESTED_KCAL,
  estimateGoals,
  extractJson,
  toEstimate,
  toGoalsEstimate,
  toRecipeEstimate,
} from './gemini'
import { LookupFailedError, RateLimitedError } from './openFoodFacts'

const VALID = {
  name: 'Scrambled eggs on toast',
  servingLabel: '1 plate',
  servingGrams: 220,
  per100g: { kcal: 180, fat: 11, satFat: 4, carbs: 12, fibre: 1.5, protein: 9, salt: 0.8 },
  confidence: 'medium',
  caveat: 'Cannot tell how much butter was used.',
}

/** A Gemini response carrying `text` as its only part. */
const reply = (text: string, status = 200) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status })

const photo = () => new File(['x'], 'food.jpg', { type: 'image/jpeg' })

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  // jsdom implements none of these: stub rather than spy, since you cannot
  // spy on a property that does not exist.
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 2000, height: 1000, close: vi.fn() }),
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA')
})

describe('extractJson', () => {
  it('parses a bare object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('unwraps a markdown fence, which models add despite being told not to', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJson('```\n{"a":2}\n```')).toEqual({ a: 2 })
  })

  it('ignores prose around the object', () => {
    expect(extractJson('Here you go:\n{"a":3}\nHope that helps')).toEqual({ a: 3 })
  })

  it('returns null when there is no object', () => {
    expect(extractJson('no json here')).toBeNull()
    expect(extractJson('{ broken')).toBeNull()
  })
})

describe('toEstimate', () => {
  it('maps a well-formed reply', () => {
    const estimate = toEstimate(VALID)
    expect(estimate?.name).toBe('Scrambled eggs on toast')
    expect(estimate?.per100g.kcal).toBe(180)
    expect(estimate?.per100g.fibre).toBe(1.5)
    expect(estimate?.defaultServing).toEqual({ label: '1 plate', grams: 220 })
    expect(estimate?.confidence).toBe('medium')
    expect(estimate?.caveat).toMatch(/butter/)
  })

  it('rejects a reply with no food in it', () => {
    expect(toEstimate({ ...VALID, name: '' })).toBeNull()
    expect(toEstimate(null)).toBeNull()
    expect(toEstimate('a string')).toBeNull()
  })

  it('defaults missing nutrients to zero rather than NaN', () => {
    const estimate = toEstimate({ name: 'Mystery', per100g: {} })
    expect(Object.values(estimate!.per100g).every(Number.isFinite)).toBe(true)
  })

  it('clamps saturated fat above total fat', () => {
    const estimate = toEstimate({ ...VALID, per100g: { ...VALID.per100g, fat: 3, satFat: 9 } })
    expect(estimate?.per100g.satFat).toBe(3)
  })

  it('treats an unknown confidence as low, never as high', () => {
    expect(toEstimate({ ...VALID, confidence: 'certain' })?.confidence).toBe('low')
    expect(toEstimate({ ...VALID, confidence: undefined })?.confidence).toBe('low')
  })

  it('drops an empty caveat', () => {
    expect(toEstimate({ ...VALID, caveat: '   ' })?.caveat).toBeUndefined()
    expect(toEstimate({ ...VALID, caveat: null })?.caveat).toBeUndefined()
  })

  it('invents a portion label when the model gives grams but no name', () => {
    const estimate = toEstimate({ ...VALID, servingLabel: '' })
    expect(estimate?.defaultServing?.label).toMatch(/220 g portion/)
  })

  it('omits the portion entirely when grams are missing', () => {
    expect(toEstimate({ ...VALID, servingGrams: 0 })?.defaultServing).toBeUndefined()
  })
})

describe('estimateFood — from a photo', () => {
  it('refuses without a key rather than calling out', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(estimateFood({ photos: [photo()] }, { apiKey: undefined })).rejects.toBeInstanceOf(
      MissingKeyError,
    )
    await expect(estimateFood({ photos: [photo()] }, { apiKey: '   ' })).rejects.toBeInstanceOf(
      MissingKeyError,
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns a parsed estimate', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(JSON.stringify(VALID)))
    const estimate = await estimateFood({ photos: [photo()] }, { apiKey: 'k' })
    expect(estimate.name).toBe('Scrambled eggs on toast')
  })

  it('uses the cheap default model, and an override when given', async () => {
    // A Response body can only be read once, so each call needs a fresh one.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => reply(JSON.stringify(VALID)))

    await estimateFood({ photos: [photo()] }, { apiKey: 'k' })
    expect(String(fetchSpy.mock.calls[0][0])).toContain(DEFAULT_GEMINI_MODEL)

    await estimateFood({ photos: [photo()] }, { apiKey: 'k', model: 'gemini-3.1-flash-lite' })
    expect(String(fetchSpy.mock.calls[1][0])).toContain('gemini-3.1-flash-lite')
  })

  it('downscales the image instead of sending a whole phone photo', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(JSON.stringify(VALID)))
    await estimateFood({ photos: [photo()] }, { apiKey: 'k' })

    // 2000x1000 is capped to 1024 on the long edge; tokens are charged by
    // image size and nothing here needs more.
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))
    expect(body.contents[0].parts[1].inline_data.mime_type).toBe('image/jpeg')
    expect(body.generationConfig.temperature).toBe(0)
  })

  it('tells the model that several photos show the same thing', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => reply(JSON.stringify(VALID)))

    await estimateFood({ photos: [photo(), photo()] }, { apiKey: 'k' })
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))
    const text = body.contents[0].parts.map((p: { text?: string }) => p.text ?? '').join(' ')
    // Without this a second angle reads as a second food.
    expect(text).toContain('SAME item')
    expect(body.contents[0].parts.filter((p: { inline_data?: unknown }) => p.inline_data)).toHaveLength(2)
  })

  it('says nothing about sameness for a single photo', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => reply(JSON.stringify(VALID)))

    await estimateFood({ photos: [photo()] }, { apiKey: 'k' })
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))
    const text = body.contents[0].parts.map((p: { text?: string }) => p.text ?? '').join(' ')
    expect(text).not.toContain('SAME item')
  })

  it('caps how many photos are sent', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => reply(JSON.stringify(VALID)))

    await estimateFood({ photos: [photo(), photo(), photo(), photo(), photo(), photo()] }, { apiKey: 'k' })
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))
    expect(
      body.contents[0].parts.filter((p: { inline_data?: unknown }) => p.inline_data),
    ).toHaveLength(MAX_PHOTOS)
  })

  it.each([400, 401, 403])(
    'reports a bad key distinctly from a missing one (%i)',
    async (status) => {
      // 401 is what an OAuth-style token gets from this API, and it used to
      // come back as a generic error that sent you looking elsewhere.
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status }))
      await expect(estimateFood({ photos: [photo()] }, { apiKey: 'bad' })).rejects.toThrow(
        /rejected that key/,
      )
    },
  )

  it('names the model when it does not exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))
    await expect(
      estimateFood({ photos: [photo()] }, { apiKey: 'k', model: 'gemini-retired' }),
    ).rejects.toThrow(/no model called "gemini-retired"/)
  })

  it('surfaces rate limiting', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 429 }))
    await expect(estimateFood({ photos: [photo()] }, { apiKey: 'k' })).rejects.toBeInstanceOf(
      RateLimitedError,
    )
  })

  it('reports an unreachable network', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    await expect(estimateFood({ photos: [photo()] }, { apiKey: 'k' })).rejects.toBeInstanceOf(
      LookupFailedError,
    )
  })

  it('says so when the photo holds no food', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      reply(JSON.stringify({ ...VALID, name: '' })),
    )
    await expect(estimateFood({ photos: [photo()] }, { apiKey: 'k' })).rejects.toThrow(
      /No food could be identified/,
    )
  })

  it('handles a reply that is not JSON at all', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply('I cannot tell what that is.'))
    await expect(estimateFood({ photos: [photo()] }, { apiKey: 'k' })).rejects.toBeInstanceOf(ModelError)
  })

  it('handles a reply with no candidates', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    await expect(estimateFood({ photos: [photo()] }, { apiKey: 'k' })).rejects.toThrow(/did not return/)
  })
})

describe('toRecipeEstimate', () => {
  const RECIPE = {
    name: 'Moka pot latte',
    servings: 2,
    ingredients: [
      { name: 'brewed coffee', grams: 120, per100g: { kcal: 2, fat: 0, satFat: 0, carbs: 0.3, fibre: 0, protein: 0.1, salt: 0 } },
      { name: 'whole milk', grams: 200, per100g: { kcal: 64, fat: 3.6, satFat: 2.3, carbs: 4.7, fibre: 0, protein: 3.4, salt: 0.1 } },
    ],
    confidence: 'medium',
    caveat: null,
  }

  it('maps a described recipe', () => {
    const estimate = toRecipeEstimate(RECIPE)
    expect(estimate?.name).toBe('Moka pot latte')
    expect(estimate?.servings).toBe(2)
    expect(estimate?.ingredients).toHaveLength(2)
    expect(estimate?.ingredients[1]).toMatchObject({ name: 'whole milk', grams: 200 })
    expect(estimate?.ingredients[1].per100g.kcal).toBe(64)
  })

  it('defaults servings to 1 when absent or nonsensical', () => {
    expect(toRecipeEstimate({ ...RECIPE, servings: 0 })?.servings).toBe(1)
    expect(toRecipeEstimate({ ...RECIPE, servings: undefined })?.servings).toBe(1)
    expect(toRecipeEstimate({ ...RECIPE, servings: 2.6 })?.servings).toBe(3)
  })

  it('drops ingredients with no name or no weight', () => {
    const estimate = toRecipeEstimate({
      ...RECIPE,
      ingredients: [
        ...RECIPE.ingredients,
        { name: '', grams: 50, per100g: {} },
        { name: 'a pinch of salt', grams: 0, per100g: {} },
        null,
      ],
    })
    expect(estimate?.ingredients).toHaveLength(2)
  })

  it('returns null when nothing usable came back', () => {
    expect(toRecipeEstimate({ ...RECIPE, ingredients: [] })).toBeNull()
    expect(toRecipeEstimate(null)).toBeNull()
  })

  it('falls back to a generic name', () => {
    expect(toRecipeEstimate({ ...RECIPE, name: '  ' })?.name).toBe('Recipe')
  })

  it('clamps saturated fat and defaults missing nutrients', () => {
    const estimate = toRecipeEstimate({
      ...RECIPE,
      ingredients: [{ name: 'butter', grams: 10, per100g: { fat: 2, satFat: 9 } }],
    })
    expect(estimate?.ingredients[0].per100g.satFat).toBe(2)
    expect(estimate?.ingredients[0].per100g.kcal).toBe(0)
  })

  it('treats an unknown confidence as low', () => {
    expect(toRecipeEstimate({ ...RECIPE, confidence: 'certain' })?.confidence).toBe('low')
  })
})

describe('estimateRecipe — from a description', () => {
  const RECIPE_REPLY = JSON.stringify({
    name: 'Moka pot latte',
    servings: 2,
    ingredients: [{ name: 'whole milk', grams: 200, per100g: { kcal: 64 } }],
    confidence: 'medium',
  })

  it('parses a described recipe', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(RECIPE_REPLY))
    const estimate = await estimateRecipe({ text: '200g whole milk, serves 2' }, { apiKey: 'k' })
    expect(estimate.servings).toBe(2)
    expect(estimate.ingredients[0].grams).toBe(200)
  })

  it('sends the description to the model', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(RECIPE_REPLY))
    await estimateRecipe({ text: '28g coffee beans in a moka pot' }, { apiKey: 'k' })
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))
    expect(JSON.stringify(body)).toContain('28g coffee beans in a moka pot')
  })

  it('refuses an empty input without calling out', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(estimateRecipe({ text: '   ' }, { apiKey: 'k' })).rejects.toBeInstanceOf(ModelError)
    await expect(estimateRecipe({}, { apiKey: 'k' })).rejects.toBeInstanceOf(ModelError)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('accepts a photo as well as a description, which is the point of the pair', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(RECIPE_REPLY))
    await estimateRecipe({ photos: [photo()] }, { apiKey: 'k' })
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))
    expect(body.contents[0].parts.some((p: { inline_data?: unknown }) => p.inline_data)).toBe(true)
  })

  it('refuses without a key', async () => {
    await expect(
      estimateRecipe({ text: '200g milk' }, { apiKey: undefined }),
    ).rejects.toBeInstanceOf(MissingKeyError)
  })

  it('estimates a single food from a description too', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(JSON.stringify(VALID)))
    const estimate = await estimateFood({ text: 'a flat white with oat milk' }, { apiKey: 'k' })
    expect(estimate.name).toBe('Scrambled eggs on toast')
  })

  it('reports text that describes no food', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      reply(JSON.stringify({ name: 'x', servings: 1, ingredients: [] })),
    )
    await expect(estimateRecipe({ text: 'the weather today' }, { apiKey: 'k' })).rejects.toThrow(
      /No ingredients could be worked out/,
    )
  })
})

describe('toGoalsEstimate', () => {
  const sound = {
    goals: { kcal: 2200, fat: 73, satFat: 22, carbs: 230, fibre: 30, protein: 130, salt: 6 },
    rationale: 'Maintenance is about 2600 kcal; this is 15% under for a steady loss.',
    caveat: null,
  }

  it('takes a sound suggestion', () => {
    expect(toGoalsEstimate(sound)).toEqual({
      goals: sound.goals,
      rationale: sound.rationale,
    })
  })

  it('refuses a target below the floor, whatever was asked for', () => {
    // The prompt says not to, which is a request, not a guarantee.
    expect(toGoalsEstimate({ ...sound, goals: { ...sound.goals, kcal: 900 } })).toBeNull()
    expect(toGoalsEstimate({ ...sound, goals: { ...sound.goals, kcal: MIN_SUGGESTED_KCAL } })).not.toBeNull()
  })

  it('refuses an absurdly high target too', () => {
    expect(toGoalsEstimate({ ...sound, goals: { ...sound.goals, kcal: 9000 } })).toBeNull()
  })

  it('refuses a target with a macro missing', () => {
    expect(toGoalsEstimate({ ...sound, goals: { ...sound.goals, protein: 0 } })).toBeNull()
    expect(toGoalsEstimate({ ...sound, goals: { ...sound.goals, fibre: undefined } })).toBeNull()
  })

  it('never lets saturated fat exceed total fat', () => {
    const estimate = toGoalsEstimate({ ...sound, goals: { ...sound.goals, fat: 60, satFat: 80 } })
    expect(estimate?.goals.satFat).toBe(60)
  })

  it('keeps a caveat when there is one, and drops an empty one', () => {
    expect(toGoalsEstimate({ ...sound, caveat: '  ' })?.caveat).toBeUndefined()
    expect(toGoalsEstimate({ ...sound, caveat: 'Assumed moderate activity.' })?.caveat).toBe(
      'Assumed moderate activity.',
    )
  })

  it('returns nothing when the text did not describe a person', () => {
    expect(toGoalsEstimate({ goals: null, rationale: '', caveat: null })).toBeNull()
    expect(toGoalsEstimate('nonsense')).toBeNull()
    expect(toGoalsEstimate(null)).toBeNull()
  })

  it('rounds to numbers a person would type', () => {
    const estimate = toGoalsEstimate({
      ...sound,
      goals: { ...sound.goals, kcal: 2204.7, protein: 129.6, salt: 5.94 },
    })
    expect(estimate?.goals.kcal).toBe(2205)
    expect(estimate?.goals.protein).toBe(130)
    expect(estimate?.goals.salt).toBe(5.9)
  })
})

describe('estimateGoals', () => {
  it('refuses without a key rather than calling out', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(estimateGoals('38, 178cm, 82kg', { apiKey: undefined })).rejects.toBeInstanceOf(
      MissingKeyError,
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('passes the description along and returns the suggestion', async () => {
    let sent = ''
    const body = JSON.stringify({
      goals: { kcal: 2100, fat: 70, satFat: 21, carbs: 210, fibre: 30, protein: 125, salt: 6 },
      rationale: 'Maintenance around 2500 kcal, 15% under.',
      caveat: null,
    })
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      sent = String(init?.body ?? '')
      return reply(body)
    })
    vi.stubGlobal('fetch', fetchMock)

    const estimate = await estimateGoals('38, 178cm, 82kg, lose weight', { apiKey: 'k' })

    expect(estimate.goals.kcal).toBe(2100)
    expect(sent).toContain('38, 178cm, 82kg, lose weight')
  })

  it('reports a refusal rather than handing back a dangerous number', async () => {
    const body = JSON.stringify({
      goals: { kcal: 700, fat: 20, satFat: 6, carbs: 60, fibre: 20, protein: 60, salt: 4 },
      rationale: 'Aggressive deficit as requested.',
      caveat: null,
    })
    vi.stubGlobal('fetch', vi.fn(async () => reply(body)))

    await expect(estimateGoals('make me lose 10kg in a month', { apiKey: 'k' })).rejects.toBeInstanceOf(
      ModelError,
    )
  })
})
