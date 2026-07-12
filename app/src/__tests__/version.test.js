import { describe, it, expect } from 'vitest'
import { APP_VERSION } from '../version'
import pkg from '../../package.json'

describe('APP_VERSION', () => {
  it('matches package.json and is a non-empty semver string', () => {
    expect(APP_VERSION).toBe(pkg.version)
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })
})
