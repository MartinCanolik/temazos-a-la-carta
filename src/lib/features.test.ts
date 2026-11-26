import { describe, expect, it } from 'vitest'
import { redMusicosVisible } from './features'

describe('redMusicosVisible', () => {
  it('hides the network from regular users when the flag is off', () => {
    expect(redMusicosVisible({ flag: false, isAdmin: false })).toBe(false)
  })

  it('shows it to admins even when the flag is off', () => {
    expect(redMusicosVisible({ flag: false, isAdmin: true })).toBe(true)
  })

  it('shows it to everyone when the flag is on', () => {
    expect(redMusicosVisible({ flag: true, isAdmin: false })).toBe(true)
    expect(redMusicosVisible({ flag: true, isAdmin: true })).toBe(true)
  })
})
