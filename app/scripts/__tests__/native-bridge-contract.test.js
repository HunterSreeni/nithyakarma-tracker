// Integration test: every native plugin method the JS app calls must exist as a
// @PluginMethod in the installed native plugin source. Pairs with r8-check.mjs,
// which proves those same methods survive minification in the shipped DEX.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectExpected, DEFAULT_SOURCE_ROOTS, BASE_PLUGIN_METHODS } from '../r8-check.mjs'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (name !== '__tests__' && name !== 'test') sources(p, out) }
    else if (/\.(js|jsx)$/.test(name) && !/\.test\./.test(name)) out.push(p)
  }
  return out
}

const native = new Map(
  collectExpected(DEFAULT_SOURCE_ROOTS(appDir))
    .filter(e => e.isPlugin)
    .map(e => [e.pluginName, new Set([...e.methods, ...BASE_PLUGIN_METHODS])]),
)

const calls = new Map()
const re = new RegExp(`\\b(${[...native.keys()].join('|')})\\.([a-zA-Z]+)\\(`, 'g')
for (const file of sources(join(appDir, 'src'))) {
  for (const [, plugin, method] of readFileSync(file, 'utf8').matchAll(re)) {
    const key = `${plugin}.${method}`
    if (!calls.has(key)) calls.set(key, file.slice(appDir.length + 1))
  }
}

describe('JS -> native plugin contract', () => {
  it('finds the native plugins the app depends on', () => {
    for (const p of ['AdMob', 'PushNotifications', 'LocalNotifications', 'Haptics', 'Share', 'Filesystem', 'App', 'Network', 'Preferences', 'InAppReview']) {
      expect(native.has(p), `${p} native source not found`).toBe(true)
    }
  })

  it('finds JS calls into native plugins', () => {
    expect(calls.size).toBeGreaterThan(15)
  })

  it.each([...calls.entries()])('%s (called from %s) exists natively', key => {
    const [plugin, method] = key.split('.')
    expect(native.get(plugin)?.has(method), `${key} is not a @PluginMethod on the native ${plugin} plugin`).toBe(true)
  })
})
