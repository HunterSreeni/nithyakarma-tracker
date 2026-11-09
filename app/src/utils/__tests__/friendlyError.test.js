import { describe, it, expect } from 'vitest'
import { friendlyError } from '../friendlyError'

describe('friendlyError', () => {
  it('maps raw errors to plain copy', () => {
    expect(friendlyError(new Error('duplicate key value violates unique constraint'))).toBe('Something went wrong. Please try again.')
  })

  it('passes through messages written for the user (e.g. a partial success)', () => {
    const err = Object.assign(new Error('Arjun was added, but Sandhyavandhanam could not be added. Add it from Today.'), { userFacing: true })
    expect(friendlyError(err)).toBe(err.message)
  })
})
