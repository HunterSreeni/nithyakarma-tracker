#!/usr/bin/env node
// R8 bridge-survival check for the minified Android release build.
//
// AI-DEV NOTE: Capacitor reaches native code by reflection: plugin classes are
// loaded by name from capacitor.plugins.json, @PluginMethod methods are matched to
// JS calls by method name, and the WebView bridge calls @JavascriptInterface
// methods by name. If R8 renames or strips any of these the app still builds but
// the feature silently dies on device. This script reads the *shipped* DEX
// (dexdump of the APK) plus R8's mapping.txt and fails if any of them was removed
// or renamed, and fails if obfuscation did not actually happen (Play flags < 25%).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Manifest components and service entry points that must keep their names.
export const FIXED_CLASSES = [
  'org.nithyakarma.app.MainActivity',
  'com.capacitorjs.plugins.pushnotifications.MessagingService',
]

// Base com.getcapacitor.Plugin methods every plugin exposes to JS.
export const BASE_PLUGIN_METHODS = ['addListener', 'removeListener', 'removeAllListeners', 'checkPermissions', 'requestPermissions']

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(java|kt)$/.test(name)) out.push(p)
  }
  return out
}

export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"\\])\/\/.*$/gm, '$1')
}

// Text of a balanced "( ... )" starting at index i (text[i] must be "("), else "".
function balanced(text, i) {
  if (text[i] !== '(') return ''
  let depth = 0
  for (let j = i; j < text.length; j++) {
    if (text[j] === '(') depth++
    else if (text[j] === ')' && --depth === 0) return text.slice(i, j + 1)
  }
  return ''
}

// Parse one Java/Kotlin source file for Capacitor plugin and JS-interface members.
export function scanSource(raw) {
  const text = stripComments(raw)
  const pkg = text.match(/^\s*package\s+([\w.]+)/m)?.[1]
  const cls = text.match(/^\s*(?:(?:public|open|internal|abstract|final|data)\s+)*class\s+(\w+)/m)?.[1]
  if (!pkg || !cls) return null
  // Only a real annotation on its own line counts (Bridge.java etc. mention it in code).
  const ann = text.match(/^[ \t]*@CapacitorPlugin\b/m)
  const isPlugin = !!ann
  const args = isPlugin ? balanced(text, ann.index + ann[0].length) : ''
  // Capacitor falls back to the simple class name when the annotation has no name.
  const pluginName = isPlugin ? (args.match(/\bname\s*=\s*"([^"]+)"/)?.[1] ?? cls) : null
  const methodsAfter = re => [...text.matchAll(re)].map(m => m[1])
  // A method declaration following the annotation (Java or Kotlin, any modifiers).
  const decl = ann => new RegExp(`@${ann}\\b(?:\\([^)]*\\))?\\s+(?:@\\w+(?:\\([^)]*\\))?\\s+)*(?:(?:public|private|protected|internal|open|override|final|static|suspend|synchronized)\\s+)*(?:fun\\s+|[\\w<>\\[\\],.?]+\\s+)(\\w+)\\s*\\(`, 'g')
  const pluginMethods = methodsAfter(decl('PluginMethod'))
  const jsInterface = methodsAfter(decl('JavascriptInterface'))
  const fqcn = `${pkg}.${cls}`
  // @PluginMethod names only matter on plugin classes and the base Plugin (JS calls are
  // matched reflectively there). Helpers like AdMob's executors are called directly
  // from Java/Kotlin, so R8 may rename them safely.
  const reflective = isPlugin || fqcn === 'com.getcapacitor.Plugin'
  if (!reflective && !jsInterface.length) return null
  return { cls: fqcn, isPlugin, pluginName, methods: [...new Set([...(reflective ? pluginMethods : []), ...jsInterface])] }
}

export function collectExpected(sourceRoots) {
  const found = []
  for (const root of sourceRoots) for (const f of walk(root)) {
    const hit = scanSource(readFileSync(f, 'utf8'))
    if (hit) found.push(hit)
  }
  return found
}

// mapping.txt: "orig.Cls -> new.Cls:" then indented member lines
// "    [a:b:]ret name(args)[:x[:y]] -> newName" (fields have no parens).
export function parseMapping(text) {
  const classes = new Map()
  let cur = null
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const c = line.match(/^(\S+) -> (\S+):$/)
    if (c) { cur = { renamed: c[2], methods: new Map() }; classes.set(c[1], cur); continue }
    const m = cur && line.match(/^\s+(?:\d+:\d+:)?\S+\s+(?:\S+\.)?([\w$<>]+)\(.*?\)(?::\d+(?::\d+)?)?\s+->\s+(\S+)$/)
    if (m) {
      if (!cur.methods.has(m[1])) cur.methods.set(m[1], new Set())
      cur.methods.get(m[1]).add(m[2])
    }
  }
  return classes
}

// dexdump plain output: "Class descriptor  : 'La/b/C;'" then method "name : 'x'" entries
// under "Direct methods" / "Virtual methods" (field names under "* fields" are skipped).
export function parseDexdump(text) {
  const classes = new Map()
  let cur = null
  let inMethods = false
  for (const line of text.split(/\r?\n/)) {
    const c = line.match(/Class descriptor\s*:\s*'L([^;]+);'/)
    if (c) { cur = new Set(); classes.set(c[1].replace(/\//g, '.'), cur); inMethods = false; continue }
    if (/^\s*(Direct|Virtual) methods\s*-/.test(line)) { inMethods = true; continue }
    if (/^\s*(Static|Instance) fields\s*-/.test(line)) { inMethods = false; continue }
    const n = inMethods && cur && line.match(/^\s+name\s*:\s*'([^']+)'/)
    if (n) cur.add(n[1])
  }
  return classes
}

export function obfuscationRatio(mapping) {
  let total = 0, renamed = 0
  for (const [orig, { renamed: to }] of mapping) { total++; if (orig !== to) renamed++ }
  return total ? renamed / total : 0
}

export function checkR8({ expected, fixedClasses = FIXED_CLASSES, mapping, dex, minRatio = 0.25 }) {
  const errors = []
  const required = [...expected, ...fixedClasses.map(cls => ({ cls, methods: [] }))]
  for (const { cls, methods } of required) {
    const inDex = dex.get(cls)
    const mapped = mapping.get(cls)
    if (mapped && mapped.renamed !== cls) errors.push(`class renamed: ${cls} -> ${mapped.renamed}`)
    if (!inDex) { errors.push(`class missing from DEX: ${cls}`); continue }
    for (const m of methods) {
      const renamedTo = [...(mapped?.methods.get(m) ?? [])].filter(n => n !== m)
      if (renamedTo.length) errors.push(`method renamed: ${cls}.${m} -> ${renamedTo.join(',')}`)
      if (!inDex.has(m)) errors.push(`method missing from DEX: ${cls}.${m}`)
    }
  }
  const ratio = obfuscationRatio(mapping)
  if (ratio < minRatio) errors.push(`obfuscation ${(ratio * 100).toFixed(1)}% is below ${minRatio * 100}%`)
  return { errors, ratio, checked: required.length }
}

export const DEFAULT_SOURCE_ROOTS = appDir => [
  join(appDir, 'android/app/src/main/java'),
  join(appDir, 'node_modules/@capacitor/android/capacitor/src/main'),
  ...['app', 'filesystem', 'haptics', 'local-notifications', 'network', 'preferences', 'push-notifications', 'share']
    .map(p => join(appDir, `node_modules/@capacitor/${p}/android/src/main`)),
  ...['admob', 'in-app-review'].map(p => join(appDir, `node_modules/@capacitor-community/${p}/android/src/main`)),
]

function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')))
  const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  if (!args.mapping || !args.dexdump) {
    console.error('usage: node scripts/r8-check.mjs --mapping=<mapping.txt> --dexdump=<dexdump.txt> [--min-ratio=0.25]')
    process.exit(2)
  }
  const expected = collectExpected(DEFAULT_SOURCE_ROOTS(appDir))
  if (!expected.some(e => e.isPlugin)) { console.error('no @CapacitorPlugin sources found - is node_modules installed?'); process.exit(2) }
  const { errors, ratio, checked } = checkR8({
    expected,
    mapping: parseMapping(readFileSync(args.mapping, 'utf8')),
    dex: parseDexdump(readFileSync(args.dexdump, 'utf8')),
    minRatio: Number(args['min-ratio'] ?? 0.25),
  })
  console.log(`R8 check: ${checked} classes, ${expected.reduce((n, e) => n + e.methods.length, 0)} bridge methods, obfuscation ${(ratio * 100).toFixed(1)}%`)
  for (const e of errors) console.log(`::error::${e}`)
  process.exit(errors.length ? 1 : 0)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
