import { describe, expect, it } from 'vitest'
import { baseName, copyName } from './copyName'

describe('copyName', () => {
  it('marks the first copy', () => {
    expect(copyName('Dhal', [])).toBe('Dhal (copy)')
  })

  it('numbers the next one, and the one after', () => {
    expect(copyName('Dhal', ['Dhal', 'Dhal (copy)'])).toBe('Dhal (copy 2)')
    expect(copyName('Dhal', ['Dhal', 'Dhal (copy)', 'Dhal (copy 2)'])).toBe('Dhal (copy 3)')
  })

  it('does not stack suffixes when copying a copy', () => {
    expect(copyName('Dhal (copy)', ['Dhal', 'Dhal (copy)'])).toBe('Dhal (copy 2)')
    expect(copyName('Dhal (copy 2)', ['Dhal', 'Dhal (copy)', 'Dhal (copy 2)'])).toBe('Dhal (copy 3)')
  })

  it('ignores case and stray spacing when checking what is taken', () => {
    expect(copyName('Dhal', ['  dhal (COPY)  '])).toBe('Dhal (copy 2)')
  })

  it('fills a gap rather than always counting to the end', () => {
    expect(copyName('Dhal', ['Dhal (copy)', 'Dhal (copy 3)'])).toBe('Dhal (copy 2)')
  })

  it('keeps a name that only looks like a copy', () => {
    expect(baseName('Copycat chilli')).toBe('Copycat chilli')
    expect(copyName('Copycat chilli', [])).toBe('Copycat chilli (copy)')
  })
})
