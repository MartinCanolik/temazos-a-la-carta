import { describe, expect, it } from 'vitest'
import { googleHabilitado } from './authSettings'

describe('googleHabilitado', () => {
  it('is true only when external.google is true', () => {
    expect(googleHabilitado({ external: { google: true, email: true } })).toBe(true)
  })

  it('is false when google is disabled or missing', () => {
    expect(googleHabilitado({ external: { google: false } })).toBe(false)
    expect(googleHabilitado({ external: { email: true } })).toBe(false)
  })

  it('is false for truthy non-boolean values', () => {
    expect(googleHabilitado({ external: { google: 'true' } })).toBe(false)
    expect(googleHabilitado({ external: { google: 1 } })).toBe(false)
  })

  it('is false for malformed input', () => {
    expect(googleHabilitado(null)).toBe(false)
    expect(googleHabilitado(undefined)).toBe(false)
    expect(googleHabilitado('x')).toBe(false)
    expect(googleHabilitado({})).toBe(false)
    expect(googleHabilitado({ external: null })).toBe(false)
  })
})
