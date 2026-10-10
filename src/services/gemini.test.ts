import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GEMINI_MODEL,
  MissingKeyError,
  ModelError,
  estimateFromPhoto,
  extractJson,
  toEstimate,
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

describe('estimateFromPhoto', () => {
  it('refuses without a key rather than calling out', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(estimateFromPhoto(photo(), { apiKey: undefined })).rejects.toBeInstanceOf(
      MissingKeyError,
    )
    await expect(estimateFromPhoto(photo(), { apiKey: '   ' })).rejects.toBeInstanceOf(
      MissingKeyError,
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns a parsed estimate', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(JSON.stringify(VALID)))
    const estimate = await estimateFromPhoto(photo(), { apiKey: 'k' })
    expect(estimate.name).toBe('Scrambled eggs on toast')
  })

  it('uses the cheap default model, and an override when given', async () => {
    // A Response body can only be read once, so each call needs a fresh one.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => reply(JSON.stringify(VALID)))

    await estimateFromPhoto(photo(), { apiKey: 'k' })
    expect(String(fetchSpy.mock.calls[0][0])).toContain(DEFAULT_GEMINI_MODEL)

    await estimateFromPhoto(photo(), { apiKey: 'k', model: 'gemini-3.1-flash-lite' })
    expect(String(fetchSpy.mock.calls[1][0])).toContain('gemini-3.1-flash-lite')
  })

  it('downscales the image instead of sending a whole phone photo', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(JSON.stringify(VALID)))
    await estimateFromPhoto(photo(), { apiKey: 'k' })

    // 2000x1000 is capped to 1024 on the long edge; tokens are charged by
    // image size and nothing here needs more.
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))
    expect(body.contents[0].parts[1].inline_data.mime_type).toBe('image/jpeg')
    expect(body.generationConfig.temperature).toBe(0)
  })

  it('reports a bad key distinctly from a missing one', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }))
    await expect(estimateFromPhoto(photo(), { apiKey: 'bad' })).rejects.toThrow(/rejected the key/)
  })

  it('names the model when it does not exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))
    await expect(
      estimateFromPhoto(photo(), { apiKey: 'k', model: 'gemini-retired' }),
    ).rejects.toThrow(/no model called "gemini-retired"/)
  })

  it('surfaces rate limiting', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 429 }))
    await expect(estimateFromPhoto(photo(), { apiKey: 'k' })).rejects.toBeInstanceOf(
      RateLimitedError,
    )
  })

  it('reports an unreachable network', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    await expect(estimateFromPhoto(photo(), { apiKey: 'k' })).rejects.toBeInstanceOf(
      LookupFailedError,
    )
  })

  it('says so when the photo holds no food', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      reply(JSON.stringify({ ...VALID, name: '' })),
    )
    await expect(estimateFromPhoto(photo(), { apiKey: 'k' })).rejects.toThrow(
      /No food could be identified/,
    )
  })

  it('handles a reply that is not JSON at all', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply('I cannot tell what that is.'))
    await expect(estimateFromPhoto(photo(), { apiKey: 'k' })).rejects.toBeInstanceOf(ModelError)
  })

  it('handles a reply with no candidates', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    await expect(estimateFromPhoto(photo(), { apiKey: 'k' })).rejects.toThrow(/did not return/)
  })
})
